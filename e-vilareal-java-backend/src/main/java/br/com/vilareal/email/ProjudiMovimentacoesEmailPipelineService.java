package br.com.vilareal.email;

import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import br.com.vilareal.projudi.ProjudiOrquestradorService;
import br.com.vilareal.projudi.ProjudiSessionService;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.util.StringUtils;

/**
 * Loop contínuo: sincroniza Gmail PROJUDI e executa modo somente Drive (progressivo) nos processos
 * com publicação vinculada ({@code processo_id}) e e-mail recebido na janela configurada.
 */
@Service
@ConditionalOnProperty(name = "vilareal.email.projudi.pipeline.enabled", havingValue = "true")
public class ProjudiMovimentacoesEmailPipelineService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiMovimentacoesEmailPipelineService.class);
    private static final int ERROS_CONSECUTIVOS_LIMITE = 3;

    private final ProjudiMovimentacoesEmailPipelineProperties properties;
    private final ProjudiMovimentacoesEmailSchedulePolicy schedulePolicy;
    private final GmailProjudiManifestacaoService gmailProjudiManifestacaoService;
    private final GmailTrtPushManifestacaoService gmailTrtPushManifestacaoService;
    private final GmailCaixaOrdemService gmailCaixaOrdemService;
    private final PublicacaoRepository publicacaoRepository;
    private final ProcessoRepository processoRepository;
    private final ProjudiOrquestradorGate orquestradorGate;
    private final ProjudiOrquestradorService orquestradorService;
    private final ProjudiSessionService sessionService;
    private final Long credencialIdPadrao;
    private final ExecutorService executor;
    private final JobRunTracker jobRunTracker;
    private final ProjudiMovimentacoesAcervoIntegralEstado acervoIntegralEstado;
    private final AtomicBoolean running = new AtomicBoolean(true);
    private final AtomicBoolean loopIniciado = new AtomicBoolean(false);

    public ProjudiMovimentacoesEmailPipelineService(
            ProjudiMovimentacoesEmailPipelineProperties properties,
            ProjudiMovimentacoesEmailSchedulePolicy schedulePolicy,
            @Autowired(required = false) GmailProjudiManifestacaoService gmailProjudiManifestacaoService,
            @Autowired(required = false) GmailTrtPushManifestacaoService gmailTrtPushManifestacaoService,
            @Autowired(required = false) GmailCaixaOrdemService gmailCaixaOrdemService,
            PublicacaoRepository publicacaoRepository,
            ProcessoRepository processoRepository,
            ProjudiOrquestradorGate orquestradorGate,
            ProjudiOrquestradorService orquestradorService,
            ProjudiSessionService sessionService,
            @Value("${projudi.orquestrador.credencial-id-padrao:1}") Long credencialIdPadrao,
            @Qualifier("projudiEmailPipelineExecutor") ExecutorService executor,
            JobRunTracker jobRunTracker,
            ProjudiMovimentacoesAcervoIntegralEstado acervoIntegralEstado) {
        this.properties = properties;
        this.schedulePolicy = schedulePolicy;
        this.gmailProjudiManifestacaoService = gmailProjudiManifestacaoService;
        this.gmailTrtPushManifestacaoService = gmailTrtPushManifestacaoService;
        this.gmailCaixaOrdemService = gmailCaixaOrdemService;
        this.publicacaoRepository = publicacaoRepository;
        this.processoRepository = processoRepository;
        this.orquestradorGate = orquestradorGate;
        this.orquestradorService = orquestradorService;
        this.sessionService = sessionService;
        this.credencialIdPadrao = credencialIdPadrao;
        this.executor = executor;
        this.jobRunTracker = jobRunTracker;
        this.acervoIntegralEstado = acervoIntegralEstado;
    }

    public void iniciarLoopEmBackground() {
        if (!loopIniciado.compareAndSet(false, true)) {
            return;
        }
        executor.execute(this::loopContinuo);
        log.info(
                "Pipeline Movimentações Email PROJUDI iniciado (janela={}d, schedule={})",
                properties.getJanelaDias(),
                properties.isScheduleEnabled());
    }

    @PreDestroy
    void parar() {
        running.set(false);
    }

    void loopContinuo() {
        while (running.get()) {
            Instant inicioCiclo = Instant.now();
            ProjudiMovimentacoesEmailSchedulePolicy.PerfilAtivo perfil = schedulePolicy.resolverPerfilAtual();
            try {
                jobRunTracker.runTrackedJobVoid(JobNames.PIPELINE_PROJUDI, ctx -> {
                    ctx.putMetadata("perfil", perfil.nome().name());
                    ctx.comHeartbeatPeriodico(() -> {
                        executarCiclo(perfil, ctx);
                        return null;
                    });
                });
            } catch (Exception e) {
                log.error("Pipeline PROJUDI: falha no ciclo (perfil={}): {}", perfil.nome(), e.getMessage(), e);
            }
            if (!running.get()) {
                break;
            }
            long aguardarMs = calcularAguardarMs(inicioCiclo, perfil.intervaloMinutos());
            log.debug(
                    "Pipeline PROJUDI: aguardando {} ms antes do próximo ciclo (perfil={})",
                    aguardarMs,
                    perfil.nome());
            dormir(aguardarMs);
        }
        log.info("Pipeline Movimentações Email PROJUDI encerrado.");
    }

    static long calcularAguardarMs(Instant inicioCiclo, int intervaloMinutos) {
        long intervaloMs = Duration.ofMinutes(Math.max(1, intervaloMinutos)).toMillis();
        long decorrido = Duration.between(inicioCiclo, Instant.now()).toMillis();
        return Math.max(0, intervaloMs - decorrido);
    }

    void executarCiclo(ProjudiMovimentacoesEmailSchedulePolicy.PerfilAtivo perfil, br.com.vilareal.jobrun.application.JobRunContext jobCtx) {
        Instant inicio = Instant.now();
        Map<String, Object> resumo = new LinkedHashMap<>();
        resumo.put("perfil", perfil.nome().name());
        resumo.put("inicio", inicio.toString());
        boolean desarme = properties.isDesarmeAcervoIntegralEnabled();
        resumo.put("desarmeAcervoIntegral", desarme);

        Set<Long> processosAtivadosEmail = new LinkedHashSet<>();
        if (gmailProjudiManifestacaoService != null && gmailProjudiManifestacaoService.isDisponivel()) {
            try {
                PublicacaoEmailProcessamentoResumo gmailResumo;
                try {
                    gmailResumo = gmailProjudiManifestacaoService.buscarEProcessarManifestacoes();
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
                resumo.put("gmailEmailsLidos", gmailResumo.getEmailsLidos());
                resumo.put("gmailPublicacoesGravadas", gmailResumo.getPublicacoesProcessadas());
                resumo.put("gmailErros", gmailResumo.getErros().size());
                if (gmailResumo.getProcessosAtivadosDrive() != null) {
                    processosAtivadosEmail.addAll(gmailResumo.getProcessosAtivadosDrive());
                }
                resumo.put("gmailProcessosAtivados", processosAtivadosEmail.size());
            } catch (Exception e) {
                log.warn("Pipeline PROJUDI: falha na sincronização Gmail: {}", e.getMessage());
                resumo.put("gmailErro", e.getMessage());
            }
        } else {
            resumo.put("gmail", "indisponivel");
        }

        if (gmailTrtPushManifestacaoService != null && gmailTrtPushManifestacaoService.isDisponivel()) {
            try {
                PublicacaoEmailProcessamentoResumo trtResumo;
                try {
                    trtResumo = gmailTrtPushManifestacaoService.buscarEProcessarManifestacoes();
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
                resumo.put("gmailTrtEmailsLidos", trtResumo.getEmailsLidos());
                resumo.put("gmailTrtPublicacoesGravadas", trtResumo.getPublicacoesProcessadas());
                resumo.put("gmailTrtErros", trtResumo.getErros().size());
            } catch (Exception e) {
                log.warn("Pipeline PROJUDI: falha na sincronização Gmail TRT: {}", e.getMessage());
                resumo.put("gmailTrtErro", e.getMessage());
            }
        } else {
            resumo.put("gmailTrt", "indisponivel");
        }

        // Sem ordem da caixa a tela oculta a publicação; atualiza após importar emails novos.
        if (gmailCaixaOrdemService != null) {
            try {
                int ordenados = gmailCaixaOrdemService.atualizarOrdemCaixaInbox();
                resumo.put("ordemCaixaAtualizados", ordenados);
            } catch (Exception e) {
                log.warn("Pipeline PROJUDI: falha ao atualizar ordem da caixa Gmail: {}", e.getMessage());
                resumo.put("ordemCaixaErro", e.getMessage());
            }
        }

        Instant desde = calcularInstanteJanela();
        List<Long> elegiveis =
                publicacaoRepository.findDistinctProcessoIdsProjudiVinculadosComEmailRecebidoDesde(desde);
        resumo.put("processosElegiveisTotal", elegiveis.size());

        List<Long> filaDrive;
        if (desarme) {
            filaDrive = ProjudiMovimentacoesAcervoIntegralEstado.montarFilaDrive(
                    elegiveis, processosAtivadosEmail, acervoIntegralEstado);
            int ignorados = elegiveis.size() - (int) elegiveis.stream().filter(id -> !acervoIntegralEstado.estaCompleto(id)).count();
            resumo.put("driveAcervoCompletoIgnorados", Math.max(0, ignorados));
            resumo.put("acervoIntegralMarcados", acervoIntegralEstado.quantidadeCompletos());
            if (filaDrive.isEmpty() && acervoIntegralEstado.todosElegiveisCompletos(elegiveis)) {
                resumo.put("drive", "desarmado — acervo integral completo na janela");
                log.info(
                        "Pipeline PROJUDI: Drive desarmado ({} processos na janela com cópia integral; aguardando e-mail novo)",
                        elegiveis.size());
            }
        } else {
            filaDrive = elegiveis;
        }

        List<Long> nestaRodada = limitarProcessos(filaDrive, perfil.maxProcessosPorCiclo());
        resumo.put("processosNestRodada", nestaRodada.size());

        if (!nestaRodada.isEmpty()) {
            boolean driveExecutado =
                    orquestradorGate.tryExecutar(
                            "pipeline-movimentacoes-email",
                            () -> executarFilaDrive(nestaRodada, perfil, resumo, jobCtx, desarme));
            if (!driveExecutado) {
                resumo.put("drive", "robô ocupado — fila adiada");
                log.info("Pipeline PROJUDI: robô ocupado, fila Drive não executada neste ciclo");
            }
        }

        resumo.put("duracaoMs", Duration.between(inicio, Instant.now()).toMillis());
        if (jobCtx != null) {
            jobCtx.putMetadata(resumo);
            Object driveProc = resumo.get("driveProcessados");
            Object gmailPub = resumo.get("gmailPublicacoesGravadas");
            int processados = 0;
            if (driveProc instanceof Number n) {
                processados += n.intValue();
            }
            if (gmailPub instanceof Number n) {
                processados += n.intValue();
            }
            jobCtx.setItemsProcessed(processados);
            Object gmailErros = resumo.get("gmailErros");
            if (gmailErros instanceof Number n) {
                jobCtx.setItemsFailed(n.intValue());
            }
        }
        log.info("Pipeline PROJUDI ciclo concluído: {}", formatarResumo(resumo));
    }

    private void executarFilaDrive(
            List<Long> processoIds,
            ProjudiMovimentacoesEmailSchedulePolicy.PerfilAtivo perfil,
            Map<String, Object> resumo,
            br.com.vilareal.jobrun.application.JobRunContext jobCtx,
            boolean desarme) {
        if (processoIds.isEmpty()) {
            resumo.put("driveProcessados", 0);
            return;
        }
        try {
            sessionService.getSessao(credencialIdPadrao);
        } catch (Exception e) {
            log.warn("Pipeline PROJUDI: falha ao aquecer sessão: {}", e.getMessage());
        }

        int processados = 0;
        int arquivosTotal = 0;
        int comTemMais = 0;
        int acervoMarcadosNesteCiclo = 0;
        int errosConsecutivos = 0;
        String motivoParada = null;

        for (int i = 0; i < processoIds.size() && running.get(); i++) {
            // Prioridade do utilizador (ex.: protocolo): cede o robô entre processos em vez de
            // segurar o lock pelo lote inteiro. O restante é arquivado no próximo ciclo.
            if (orquestradorGate.haPrioridadeAguardando()) {
                motivoParada = "cedido a protocolo do utilizador";
                log.info(
                        "Pipeline PROJUDI: cedendo o robô a um protocolo do utilizador; {} processo(s) restante(s) no próximo ciclo.",
                        processoIds.size() - i);
                break;
            }
            if (jobCtx != null) {
                jobCtx.heartbeatACadaItens(i + 1, 1);
            }
            Long processoId = processoIds.get(i);
            ProcessoEntity processo =
                    processoRepository.findByIdWithClienteAndPessoa(processoId).orElse(null);
            if (processo == null) {
                errosConsecutivos++;
                log.warn("Pipeline PROJUDI: processo {} não encontrado", processoId);
                if (errosConsecutivos >= ERROS_CONSECUTIVOS_LIMITE) {
                    motivoParada = "3 erros consecutivos (processo ausente)";
                    break;
                }
                continue;
            }

            List<String> detalhes = new ArrayList<>();
            ProjudiOrquestradorService.ResultadoSomenteDriveProcesso resultado =
                    orquestradorService.executarSomenteDriveProgressivo(
                            credencialIdPadrao, processo, detalhes);

            processados++;
            arquivosTotal += resultado.arquivosBaixados();
            if (resultado.temMais()) {
                comTemMais++;
            }

            if (resultado.erro() != null) {
                log.warn(
                        "Pipeline PROJUDI processoId={} cnj={}: {}",
                        processoId,
                        processo.getNumeroCnj(),
                        resultado.erro());
                if (indicaBloqueioOuErroGrave(resultado.erro())) {
                    motivoParada = "bloqueio/erro grave: " + resultado.erro();
                    break;
                }
                errosConsecutivos++;
                if (errosConsecutivos >= ERROS_CONSECUTIVOS_LIMITE) {
                    motivoParada = "3 erros consecutivos";
                    break;
                }
            } else {
                errosConsecutivos = 0;
                log.info(
                        "Pipeline PROJUDI processoId={}: arquivosBaixados={} temMais={}",
                        processoId,
                        resultado.arquivosBaixados(),
                        resultado.temMais());
            }

            if (desarme) {
                boolean marcou =
                        ProjudiMovimentacoesAcervoIntegralEstado.indicaAcervoIntegralCompleto(resultado);
                acervoIntegralEstado.atualizarAposExecucaoDrive(processoId, resultado);
                if (marcou) {
                    acervoMarcadosNesteCiclo++;
                    log.info(
                            "Pipeline PROJUDI processoId={}: acervo integral completo ({} movimentações com documento no Drive)",
                            processoId,
                            resultado.totalComDocumento());
                }
            }

            if (motivoParada != null) {
                break;
            }
            if (i < processoIds.size() - 1 && perfil.delaySegundosEntreProcessos() > 0) {
                dormirCedendoPrioridade(perfil.delaySegundosEntreProcessos() * 1000L);
            }
        }

        resumo.put("driveProcessados", processados);
        resumo.put("driveArquivosBaixados", arquivosTotal);
        resumo.put("driveComTemMais", comTemMais);
        if (desarme) {
            resumo.put("driveAcervoMarcadosNesteCiclo", acervoMarcadosNesteCiclo);
        }
        if (motivoParada != null) {
            resumo.put("driveParadaAntecipada", motivoParada);
        }
    }

    private Instant calcularInstanteJanela() {
        ZoneId zone;
        try {
            zone = ZoneId.of(properties.getTimezone());
        } catch (Exception e) {
            zone = ZoneId.of("America/Sao_Paulo");
        }
        int dias = Math.max(1, properties.getJanelaDias());
        return ZonedDateTime.now(zone).minusDays(dias).toInstant();
    }

    private static List<Long> limitarProcessos(List<Long> ids, int maxPorCiclo) {
        if (maxPorCiclo <= 0 || ids.size() <= maxPorCiclo) {
            return ids;
        }
        return List.copyOf(ids.subList(0, maxPorCiclo));
    }

    private static String formatarResumo(Map<String, Object> resumo) {
        StringBuilder sb = new StringBuilder();
        resumo.forEach((k, v) -> sb.append(k).append('=').append(v).append(' '));
        return sb.toString().trim();
    }

    private static boolean indicaBloqueioOuErroGrave(String erro) {
        if (!StringUtils.hasText(erro)) {
            return false;
        }
        String lower = erro.toLowerCase(Locale.ROOT);
        return lower.contains("captcha")
                || lower.contains("bloqueio")
                || lower.contains("bloqueado")
                || lower.contains("too many")
                || lower.contains("rate limit")
                || lower.contains("tela de login")
                || lower.contains("acesso negado")
                || lower.contains("forbidden")
                || lower.contains(" 403")
                || lower.contains(" 429");
    }

    private static void dormir(long ms) {
        if (ms <= 0) {
            return;
        }
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** Dorme em blocos curtos, abortando cedo se surgir operação prioritária do utilizador. */
    private void dormirCedendoPrioridade(long ms) {
        long restante = ms;
        while (restante > 0 && running.get()) {
            if (orquestradorGate.haPrioridadeAguardando()) {
                return;
            }
            long bloco = Math.min(500L, restante);
            try {
                Thread.sleep(bloco);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            restante -= bloco;
        }
    }
}
