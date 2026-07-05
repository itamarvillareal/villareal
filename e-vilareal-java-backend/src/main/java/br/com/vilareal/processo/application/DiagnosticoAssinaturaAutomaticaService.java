package br.com.vilareal.processo.application;

import br.com.vilareal.assinador.application.AssinaturaLoteService;
import br.com.vilareal.assinador.domain.AssinaturaLoteStatus;
import br.com.vilareal.assinador.infrastructure.persistence.entity.AssinaturaLoteEntity;
import br.com.vilareal.assinador.infrastructure.persistence.repository.AssinaturaLoteRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.processo.api.dto.AssinarAutomaticoResponse;
import br.com.vilareal.processo.api.dto.DiagnosticoAguardandoProtocoloItemRequest;
import br.com.vilareal.processo.api.dto.LoteAssinaturaStatusResponse;
import br.com.vilareal.processo.api.dto.PrepararAssinarResultado;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Orquestra assinatura automática (Diagnósticos → Aguardando Protocolo): prepara PDFs no Drive
 * e enfileira lote para o assinador Windows (pull).
 */
@Service
public class DiagnosticoAssinaturaAutomaticaService {

    static final String MSG_TOKEN_OCUPADO =
            "Token em uso por outro programa. Feche o sai.jar e use «Tentar novamente».";

    private final DiagnosticoAguardandoProtocoloAssinarService diagnosticoAssinarService;
    private final AssinaturaLoteService assinaturaLoteService;
    private final AssinaturaLoteRepository assinaturaLoteRepository;

    public DiagnosticoAssinaturaAutomaticaService(
            DiagnosticoAguardandoProtocoloAssinarService diagnosticoAssinarService,
            AssinaturaLoteService assinaturaLoteService,
            AssinaturaLoteRepository assinaturaLoteRepository) {
        this.diagnosticoAssinarService = diagnosticoAssinarService;
        this.assinaturaLoteService = assinaturaLoteService;
        this.assinaturaLoteRepository = assinaturaLoteRepository;
    }

    @Transactional
    public AssinarAutomaticoResponse assinarAutomatico(
            Long credencialId, List<DiagnosticoAguardandoProtocoloItemRequest> processos) {
        PrepararAssinarResultado preparado = diagnosticoAssinarService.prepararAssinatura(credencialId, processos);
        List<Long> peticaoIds = normalizarIds(preparado.peticaoIds());
        if (peticaoIds.isEmpty()) {
            throw new BusinessRuleException(
                    "Nenhum PDF pendente para assinar. Verifique a pasta «Assinar» no Drive.");
        }

        Optional<AssinaturaLoteEntity> loteErro = buscarLoteComIntersecao(
                peticaoIds, List.of(AssinaturaLoteStatus.ERRO));
        if (loteErro.isPresent()) {
            throw new BusinessRuleException(
                    "Já existe lote #" + loteErro.get().getId() + " com erro ("
                            + loteErro.get().getErroCodigo()
                            + "). Use «Tentar novamente» para re-libera-lo, sem preparar de novo.");
        }

        Optional<AssinaturaLoteEntity> emAndamento = buscarLoteComIntersecao(
                peticaoIds, List.of(AssinaturaLoteStatus.EM_ASSINATURA));
        if (emAndamento.isPresent()) {
            throw new BusinessRuleException(
                    "Assinatura automática já em andamento (lote #" + emAndamento.get().getId() + "). "
                            + "Aguarde a conclusão ou a falha do assinador.");
        }

        Optional<AssinaturaLoteEntity> liberado = buscarLoteComIntersecao(
                peticaoIds, List.of(AssinaturaLoteStatus.LIBERADO));
        if (liberado.isPresent()) {
            AssinaturaLoteEntity existente = liberado.get();
            return new AssinarAutomaticoResponse(
                    existente.getId(),
                    copiarIds(existente.getPeticaoIds()),
                    preparado.totalArquivos(),
                    true);
        }

        AssinaturaLoteEntity criado = assinaturaLoteService.criarLote(peticaoIds, credencialId);
        return new AssinarAutomaticoResponse(
                criado.getId(), peticaoIds, preparado.totalArquivos(), false);
    }

    @Transactional(readOnly = true)
    public LoteAssinaturaStatusResponse consultarStatus(Long loteId) {
        AssinaturaLoteEntity lote = assinaturaLoteService.buscarPorId(loteId);
        return montarStatus(lote);
    }

    @Transactional
    public LoteAssinaturaStatusResponse reliberar(Long loteId) {
        AssinaturaLoteEntity lote = assinaturaLoteService.reliberarLote(loteId);
        return montarStatus(lote);
    }

    private Optional<AssinaturaLoteEntity> buscarLoteComIntersecao(
            List<Long> peticaoIds, List<AssinaturaLoteStatus> statuses) {
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            return Optional.empty();
        }
        Set<Long> alvo = new HashSet<>(peticaoIds);
        return assinaturaLoteRepository.findByStatusIn(statuses).stream()
                .filter(lote -> intersecta(alvo, lote.getPeticaoIds()))
                .findFirst();
    }

    private static boolean intersecta(Set<Long> alvo, List<Long> candidato) {
        if (candidato == null || candidato.isEmpty()) {
            return false;
        }
        for (Long id : candidato) {
            if (id != null && alvo.contains(id)) {
                return true;
            }
        }
        return false;
    }

    private static List<Long> normalizarIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return new ArrayList<>(new LinkedHashSet<>(ids));
    }

    private static List<Long> copiarIds(List<Long> ids) {
        return ids != null ? List.copyOf(ids) : List.of();
    }

    private static LoteAssinaturaStatusResponse montarStatus(AssinaturaLoteEntity lote) {
        return new LoteAssinaturaStatusResponse(
                lote.getId(),
                lote.getStatus(),
                copiarIds(lote.getPeticaoIds()),
                lote.getCredencialId(),
                lote.getErroCodigo(),
                lote.getErroMensagem(),
                mensagemUsuario(lote),
                lote.getResultadoJson());
    }

    private static String mensagemUsuario(AssinaturaLoteEntity lote) {
        if (lote.getStatus() != AssinaturaLoteStatus.ERRO) {
            return null;
        }
        if ("TOKEN_OCUPADO".equals(lote.getErroCodigo())) {
            return StringUtils.hasText(lote.getErroMensagem()) ? lote.getErroMensagem() : MSG_TOKEN_OCUPADO;
        }
        return lote.getErroMensagem();
    }
}
