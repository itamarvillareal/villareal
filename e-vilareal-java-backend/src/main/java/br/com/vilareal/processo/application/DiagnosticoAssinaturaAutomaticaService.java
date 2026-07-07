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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Orquestra assinatura automática (Diagnósticos → Aguardando Protocolo): enfileira lote PREPARANDO,
 * busca PDFs no Drive em segundo plano e libera para o assinador Windows (pull).
 */
@Service
public class DiagnosticoAssinaturaAutomaticaService {

    private static final Logger log = LoggerFactory.getLogger(DiagnosticoAssinaturaAutomaticaService.class);

    static final String MSG_TOKEN_OCUPADO =
            "Token em uso por outro programa. Feche o sai.jar e use «Tentar novamente».";

    private final DiagnosticoAguardandoProtocoloAssinarService diagnosticoAssinarService;
    private final AssinaturaLoteService assinaturaLoteService;
    private final AssinaturaLoteRepository assinaturaLoteRepository;
    private final ObjectMapper objectMapper;
    private final ExecutorService preparoExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "assinatura-lote-preparo");
        t.setDaemon(true);
        return t;
    });

    public DiagnosticoAssinaturaAutomaticaService(
            DiagnosticoAguardandoProtocoloAssinarService diagnosticoAssinarService,
            AssinaturaLoteService assinaturaLoteService,
            AssinaturaLoteRepository assinaturaLoteRepository,
            ObjectMapper objectMapper) {
        this.diagnosticoAssinarService = diagnosticoAssinarService;
        this.assinaturaLoteService = assinaturaLoteService;
        this.assinaturaLoteRepository = assinaturaLoteRepository;
        this.objectMapper = objectMapper;
    }

    @PreDestroy
    void encerrarExecutor() {
        preparoExecutor.shutdown();
    }

    @Transactional
    public AssinarAutomaticoResponse assinarAutomatico(
            Long credencialId, List<DiagnosticoAguardandoProtocoloItemRequest> processos) {
        if (credencialId == null) {
            throw new BusinessRuleException("credencialId é obrigatório.");
        }
        if (processos == null || processos.isEmpty()) {
            throw new BusinessRuleException("Nenhum processo informado.");
        }

        Optional<AssinaturaLoteEntity> preparandoIgual =
                buscarPreparandoMesmaSelecao(credencialId, processos);
        if (preparandoIgual.isPresent()) {
            AssinaturaLoteEntity existente = preparandoIgual.get();
            return new AssinarAutomaticoResponse(
                    existente.getId(),
                    copiarIds(existente.getPeticaoIds()),
                    totalArquivosMeta(existente),
                    true);
        }

        Optional<AssinaturaLoteEntity> emAssinatura = assinaturaLoteRepository
                .findByStatusIn(List.of(AssinaturaLoteStatus.EM_ASSINATURA))
                .stream()
                .filter(l -> credencialId.equals(l.getCredencialId()))
                .findFirst();
        if (emAssinatura.isPresent()) {
            throw new BusinessRuleException(
                    "Assinatura automática já em andamento (lote #" + emAssinatura.get().getId() + "). "
                            + "Aguarde a conclusão ou a falha do assinador.");
        }

        JsonNode meta = montarMetaPreparo(processos);
        AssinaturaLoteEntity criado = assinaturaLoteService.criarLoteEmPreparacao(credencialId, meta);
        agendarPreparoAposCommit(criado.getId(), credencialId, processos);
        return new AssinarAutomaticoResponse(criado.getId(), List.of(), 0, false);
    }

    /** Só dispara o executor após commit — evita race em que o lote ainda não é visível na thread de background. */
    private void agendarPreparoAposCommit(
            Long loteId, Long credencialId, List<DiagnosticoAguardandoProtocoloItemRequest> processos) {
        Runnable tarefa = () -> executarPreparoEmBackground(loteId, credencialId, processos);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    preparoExecutor.submit(tarefa);
                }
            });
        } else {
            preparoExecutor.submit(tarefa);
        }
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

    @Transactional
    public LoteAssinaturaStatusResponse cancelar(Long loteId) {
        AssinaturaLoteEntity lote = assinaturaLoteService.cancelarPreparacao(loteId);
        return montarStatus(lote);
    }

    /** Visível para testes (mesmo pacote). */
    void executarPreparoEmBackground(
            Long loteId, Long credencialId, List<DiagnosticoAguardandoProtocoloItemRequest> processos) {
        try {
            PrepararAssinarResultado preparado =
                    diagnosticoAssinarService.prepararAssinatura(credencialId, processos, false, loteId);
            List<Long> peticaoIds = normalizarIds(preparado.peticaoIds());
            if (peticaoIds.isEmpty()) {
                assinaturaLoteService.falharPreparacao(
                        loteId,
                        "PREPARO_VAZIO",
                        mensagemPreparoVazio(preparado));
                return;
            }

            Optional<AssinaturaLoteEntity> liberado = buscarLoteComIntersecao(
                    peticaoIds, List.of(AssinaturaLoteStatus.LIBERADO));
            if (liberado.isPresent() && !liberado.get().getId().equals(loteId)) {
                AssinaturaLoteEntity outro = liberado.get();
                assinaturaLoteService.falharPreparacao(
                        loteId,
                        "LOTE_DUPLICADO",
                        "Já existe lote #" + outro.getId() + " liberado para os mesmos PDFs. Use-o ou aguarde.");
                return;
            }

            Optional<AssinaturaLoteEntity> emAssinatura = buscarLoteComIntersecao(
                    peticaoIds, List.of(AssinaturaLoteStatus.EM_ASSINATURA));
            if (emAssinatura.isPresent()) {
                assinaturaLoteService.falharPreparacao(
                        loteId,
                        "EM_ASSINATURA",
                        "Assinatura já em andamento (lote #" + emAssinatura.get().getId() + ").");
                return;
            }

            assinaturaLoteService.concluirPreparacao(loteId, peticaoIds, preparado.totalArquivos());
            log.info(
                    "Preparo assíncrono concluído: lote #{} — {} petição(ões), {} PDF(s)",
                    loteId,
                    peticaoIds.size(),
                    preparado.totalArquivos());
        } catch (PreparoCanceladoException e) {
            if (e.statusObservado() == AssinaturaLoteStatus.CANCELADO) {
                log.info("Preparo abortado cooperativamente (lote #{}): {}", loteId, e.getMessage());
                return;
            }
            log.warn("Preparo abortado inesperadamente (lote #{}): {}", loteId, e.getMessage());
            assinaturaLoteService.falharPreparacao(loteId, "PREPARO_ABORTADO", e.getMessage());
        } catch (BusinessRuleException e) {
            log.warn("Preparo assíncrono falhou (lote #{}): {}", loteId, e.getMessage());
            assinaturaLoteService.falharPreparacao(loteId, "PREPARO_FALHOU", e.getMessage());
        } catch (Exception e) {
            log.error("Preparo assíncrono inesperado (lote #{}): {}", loteId, e.getMessage(), e);
            assinaturaLoteService.falharPreparacao(
                    loteId, "PREPARO_FALHOU", "Falha ao preparar PDFs: " + e.getMessage());
        }
    }

    private static String mensagemPreparoVazio(PrepararAssinarResultado preparado) {
        if (preparado != null && preparado.resumo() != null) {
            long erros = preparado.resumo().stream()
                    .filter(PrepararAssinarResultado.ResumoProcessoPrepararAssinar::ignoradoPorErro)
                    .count();
            if (erros > 0) {
                return DiagnosticoAguardandoProtocoloAssinarService.montarMensagemNenhumPdfPreparado(
                        preparado.resumo());
            }
        }
        return "Nenhum PDF pendente para assinar. Verifique a pasta «Assinar» no Drive.";
    }

    private Optional<AssinaturaLoteEntity> buscarPreparandoMesmaSelecao(
            Long credencialId, List<DiagnosticoAguardandoProtocoloItemRequest> processos) {
        String fp = fingerprintProcessos(processos);
        return assinaturaLoteRepository
                .findByStatusAndCredencialIdOrderByCriadoEmDesc(AssinaturaLoteStatus.PREPARANDO, credencialId)
                .stream()
                .filter(l -> fp.equals(fingerprintMeta(l.getResultadoJson())))
                .findFirst();
    }

    private JsonNode montarMetaPreparo(List<DiagnosticoAguardandoProtocoloItemRequest> processos) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("fingerprint", fingerprintProcessos(processos));
        ArrayNode arr = root.putArray("processos");
        for (DiagnosticoAguardandoProtocoloItemRequest p : processos) {
            ObjectNode item = arr.addObject();
            item.put("codigoCliente", p.getCodigoCliente());
            item.put("numeroInterno", p.getNumeroInterno());
            if (StringUtils.hasText(p.getNumeroProcessoNovo())) {
                item.put("numeroProcessoNovo", p.getNumeroProcessoNovo());
            }
        }
        return root;
    }

    private static String fingerprintProcessos(List<DiagnosticoAguardandoProtocoloItemRequest> processos) {
        StringBuilder sb = new StringBuilder();
        for (DiagnosticoAguardandoProtocoloItemRequest p : processos) {
            sb.append(String.valueOf(p.getCodigoCliente()).trim())
                    .append('|')
                    .append(p.getNumeroInterno())
                    .append('|')
                    .append(String.valueOf(p.getNumeroProcessoNovo()).trim())
                    .append(';');
        }
        return sb.toString();
    }

    private static String fingerprintMeta(JsonNode meta) {
        if (meta != null && meta.hasNonNull("fingerprint")) {
            return meta.get("fingerprint").asText("");
        }
        return "";
    }

    private static int totalArquivosMeta(AssinaturaLoteEntity lote) {
        JsonNode meta = lote.getResultadoJson();
        if (meta != null && meta.has("totalArquivos")) {
            return meta.get("totalArquivos").asInt(0);
        }
        return 0;
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
