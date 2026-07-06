package br.com.vilareal.assinador.application;

import br.com.vilareal.assinador.domain.AssinaturaLoteStatus;
import br.com.vilareal.assinador.infrastructure.persistence.entity.AssinaturaLoteEntity;
import br.com.vilareal.assinador.infrastructure.persistence.repository.AssinaturaLoteRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

@Service
public class AssinaturaLoteService {

    private final AssinaturaLoteRepository repository;
    private final Clock clock;

    public AssinaturaLoteService(AssinaturaLoteRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    /** Cria lote vazio em preparo assíncrono (petição ids preenchidos após Drive). */
    @Transactional
    public AssinaturaLoteEntity criarLoteEmPreparacao(Long credencialId, JsonNode metaPreparo) {
        if (credencialId == null) {
            throw new BusinessRuleException("credencialId é obrigatório.");
        }
        AssinaturaLoteEntity lote = new AssinaturaLoteEntity();
        lote.setStatus(AssinaturaLoteStatus.PREPARANDO);
        lote.setPeticaoIds(new ArrayList<>());
        lote.setCredencialId(credencialId);
        lote.setResultadoJson(metaPreparo);
        return repository.save(lote);
    }

    @Transactional
    public AssinaturaLoteEntity concluirPreparacao(Long loteId, List<Long> peticaoIds, int totalArquivos) {
        AssinaturaLoteEntity lote = buscarObrigatorio(loteId);
        exigirStatus(lote, AssinaturaLoteStatus.PREPARANDO, "concluir preparação");
        List<Long> ids = normalizarPeticaoIds(peticaoIds);
        if (ids.isEmpty()) {
            throw new BusinessRuleException("Nenhuma petição após preparo.");
        }
        lote.setPeticaoIds(ids);
        lote.setStatus(AssinaturaLoteStatus.LIBERADO);
        JsonNode meta = lote.getResultadoJson();
        if (meta != null && meta.isObject()) {
            ObjectNode obj = (ObjectNode) meta;
            obj.put("totalArquivos", totalArquivos);
        }
        lote.setErroCodigo(null);
        lote.setErroMensagem(null);
        return repository.save(lote);
    }

    @Transactional
    public AssinaturaLoteEntity falharPreparacao(Long loteId, String codigo, String mensagem) {
        if (!StringUtils.hasText(codigo)) {
            throw new BusinessRuleException("erro_codigo é obrigatório.");
        }
        if (!StringUtils.hasText(mensagem)) {
            throw new BusinessRuleException("erro_mensagem é obrigatório.");
        }
        AssinaturaLoteEntity lote = buscarObrigatorio(loteId);
        exigirStatus(lote, AssinaturaLoteStatus.PREPARANDO, "falhar preparação");
        lote.setStatus(AssinaturaLoteStatus.ERRO);
        lote.setErroCodigo(codigo.trim());
        lote.setErroMensagem(mensagem.trim());
        limparLock(lote);
        return repository.save(lote);
    }

    @Transactional
    public AssinaturaLoteEntity criarLote(List<Long> peticaoIds, Long credencialId) {
        if (credencialId == null) {
            throw new BusinessRuleException("credencialId é obrigatório.");
        }
        List<Long> idsNormalizados = normalizarPeticaoIds(peticaoIds);
        if (idsNormalizados.isEmpty()) {
            throw new BusinessRuleException("peticaoIds é obrigatório (ao menos uma petição).");
        }

        AssinaturaLoteEntity lote = new AssinaturaLoteEntity();
        lote.setStatus(AssinaturaLoteStatus.LIBERADO);
        lote.setPeticaoIds(idsNormalizados);
        lote.setCredencialId(credencialId);
        return repository.save(lote);
    }

    /**
     * Claim atômico do próximo lote liberado (long-poll do assinador Windows).
     *
     * @param lockedBy identificador do assinador (hostname, instância, etc.)
     */
    @Transactional
    public Optional<AssinaturaLoteEntity> pegarProximoLotePendente(String lockedBy) {
        if (!StringUtils.hasText(lockedBy)) {
            throw new BusinessRuleException("lockedBy é obrigatório.");
        }
        Optional<Long> id = repository.findProximoLiberadoIdParaClaim();
        if (id.isEmpty()) {
            return Optional.empty();
        }
        AssinaturaLoteEntity lote = repository
                .findById(id.get())
                .orElseThrow(() -> new IllegalStateException("lote " + id.get() + " sumiu após claim"));
        if (lote.getStatus() != AssinaturaLoteStatus.LIBERADO) {
            return Optional.empty();
        }
        Instant agora = clock.instant();
        lote.setStatus(AssinaturaLoteStatus.EM_ASSINATURA);
        lote.setLockedAt(agora);
        lote.setLockedBy(lockedBy.trim());
        lote.setErroCodigo(null);
        lote.setErroMensagem(null);
        return Optional.of(repository.save(lote));
    }

    @Transactional
    public AssinaturaLoteEntity concluirLote(Long loteId, JsonNode resultado) {
        AssinaturaLoteEntity lote = buscarObrigatorio(loteId);
        exigirStatus(lote, AssinaturaLoteStatus.EM_ASSINATURA, "concluir");
        lote.setStatus(AssinaturaLoteStatus.CONCLUIDO);
        lote.setResultadoJson(resultado);
        limparLock(lote);
        lote.setErroCodigo(null);
        lote.setErroMensagem(null);
        return repository.save(lote);
    }

    @Transactional
    public AssinaturaLoteEntity falharLote(Long loteId, String codigo, String mensagem) {
        if (!StringUtils.hasText(codigo)) {
            throw new BusinessRuleException("erro_codigo é obrigatório.");
        }
        if (!StringUtils.hasText(mensagem)) {
            throw new BusinessRuleException("erro_mensagem é obrigatório.");
        }
        AssinaturaLoteEntity lote = buscarObrigatorio(loteId);
        exigirStatus(lote, AssinaturaLoteStatus.EM_ASSINATURA, "falhar");
        lote.setStatus(AssinaturaLoteStatus.ERRO);
        lote.setErroCodigo(codigo.trim());
        lote.setErroMensagem(mensagem.trim());
        limparLock(lote);
        return repository.save(lote);
    }

    /** Re-libera lote após erro recuperável (ex.: TOKEN_OCUPADO) para nova tentativa do assinador. */
    @Transactional
    public AssinaturaLoteEntity reliberarLote(Long loteId) {
        AssinaturaLoteEntity lote = buscarObrigatorio(loteId);
        exigirStatus(lote, AssinaturaLoteStatus.ERRO, "reliberar");
        lote.setStatus(AssinaturaLoteStatus.LIBERADO);
        lote.setErroCodigo(null);
        lote.setErroMensagem(null);
        limparLock(lote);
        return repository.save(lote);
    }

    @Transactional(readOnly = true)
    public AssinaturaLoteEntity buscarPorId(Long loteId) {
        return buscarObrigatorio(loteId);
    }

    /** Garante que o lote está em assinatura e travado pelo assinador que fez o claim. */
    @Transactional(readOnly = true)
    public AssinaturaLoteEntity exigirLoteEmAssinaturaDoAssinador(Long loteId, String assinadorId) {
        if (!StringUtils.hasText(assinadorId)) {
            throw new BusinessRuleException("X-Assinador-Id é obrigatório.");
        }
        AssinaturaLoteEntity lote = buscarObrigatorio(loteId);
        if (lote.getStatus() != AssinaturaLoteStatus.EM_ASSINATURA) {
            throw new BusinessRuleException(
                    "Lote #" + loteId + " não está em assinatura (status: " + lote.getStatus() + ").");
        }
        String travadoPor = lote.getLockedBy() != null ? lote.getLockedBy().trim() : "";
        if (!assinadorId.trim().equals(travadoPor)) {
            throw new BusinessRuleException("Lote #" + loteId + " está travado por outro assinador.");
        }
        return lote;
    }

    private AssinaturaLoteEntity buscarObrigatorio(Long loteId) {
        if (loteId == null) {
            throw new BusinessRuleException("loteId é obrigatório.");
        }
        return repository
                .findById(loteId)
                .orElseThrow(() -> new BusinessRuleException("Lote de assinatura não encontrado: " + loteId));
    }

    private static void exigirStatus(
            AssinaturaLoteEntity lote, AssinaturaLoteStatus esperado, String operacao) {
        if (lote.getStatus() != esperado) {
            throw new BusinessRuleException(
                    "Não é possível " + operacao + " o lote #" + lote.getId() + " no status " + lote.getStatus()
                            + " (esperado: " + esperado + ").");
        }
    }

    private static void limparLock(AssinaturaLoteEntity lote) {
        lote.setLockedAt(null);
        lote.setLockedBy(null);
    }

    private static List<Long> normalizarPeticaoIds(List<Long> peticaoIds) {
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Long> unicos = new LinkedHashSet<>();
        for (Long id : peticaoIds) {
            if (id != null) {
                unicos.add(id);
            }
        }
        return new ArrayList<>(unicos);
    }
}
