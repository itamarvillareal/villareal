package br.com.vilareal.processo.application;

import br.com.vilareal.jobrun.application.JobRunContext;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

/**
 * Backfill do PDF consolidado na pasta pai de Movimentações — últimos processos da lista
 * Movimentações Email (origem PROJUDI) ou lote por ano CNJ (ex.: 2026) com acervo integral completo.
 */
@Service
public class ProcessoMovimentacoesConsolidadoDriveBackfillService {

    private static final Logger log = LoggerFactory.getLogger(ProcessoMovimentacoesConsolidadoDriveBackfillService.class);

    private final PublicacaoRepository publicacaoRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoMovimentacoesConsolidadoDriveAutoService consolidadoDriveAutoService;
    private final ProcessoProjudiAcervoIntegralDriveCheckerService acervoIntegralChecker;
    private final int limitePadrao;
    private final int timeoutProcessoSegundos;
    private final long delayEntreProcessosMs;
    private final Long credencialIdPadrao;

    public ProcessoMovimentacoesConsolidadoDriveBackfillService(
            PublicacaoRepository publicacaoRepository,
            ProcessoRepository processoRepository,
            ProcessoMovimentacoesConsolidadoDriveAutoService consolidadoDriveAutoService,
            ProcessoProjudiAcervoIntegralDriveCheckerService acervoIntegralChecker,
            @Value("${vilareal.processo.movimentacoes.consolidado.backfill.limite-padrao:100}")
                    int limitePadrao,
            @Value("${vilareal.processo.movimentacoes.consolidado.backfill.timeout-processo-segundos:300}")
                    int timeoutProcessoSegundos,
            @Value("${vilareal.processo.movimentacoes.consolidado.backfill.delay-ms:200}")
                    long delayEntreProcessosMs,
            @Value("${projudi.orquestrador.credencial-id-padrao:1}") Long credencialIdPadrao) {
        this.publicacaoRepository = publicacaoRepository;
        this.processoRepository = processoRepository;
        this.consolidadoDriveAutoService = consolidadoDriveAutoService;
        this.acervoIntegralChecker = acervoIntegralChecker;
        this.limitePadrao = limitePadrao > 0 ? limitePadrao : 100;
        this.timeoutProcessoSegundos = timeoutProcessoSegundos > 0 ? timeoutProcessoSegundos : 300;
        this.delayEntreProcessosMs = Math.max(0, delayEntreProcessosMs);
        this.credencialIdPadrao = credencialIdPadrao;
    }

    public Map<String, Object> executarBackfill(Integer limiteInformado) {
        return executarBackfill(limiteInformado, null);
    }

    public Map<String, Object> executarBackfill(Integer limiteInformado, JobRunContext jobCtx) {
        int limite = limiteInformado != null && limiteInformado > 0 ? limiteInformado : limitePadrao;

        List<Long> processoIds =
                publicacaoRepository.findUltimosProcessoIdsMovimentacoesEmailProjudi(limite);
        if (processoIds.isEmpty()) {
            processoIds = publicacaoRepository.findDistinctProcessoIdsComPublicacaoProjudiCnjCompleto().stream()
                    .limit(limite)
                    .toList();
        }

        Map<String, Object> out = iniciarResumo("ultimos-email", limite, null);
        executarLote(processoIds, out, jobCtx, false);
        return out;
    }

    /** Processos Projudi do ano CNJ com publicação/e-mail e acervo integral completo em Movimentações. */
    public Map<String, Object> executarBackfillPorAno(int ano, JobRunContext jobCtx) {
        if (ano < 2000 || ano > 2100) {
            throw new IllegalArgumentException("Ano CNJ inválido: " + ano);
        }
        List<Long> candidatos = processoRepository.findIdsProjudiComPublicacaoPorAnoCnj(ano);
        Map<String, Object> out = iniciarResumo("ano-cnj-acervo-completo", null, ano);
        out.put("candidatosAno", candidatos.size());
        executarLote(candidatos, out, jobCtx, true);
        return out;
    }

    private Map<String, Object> iniciarResumo(String modo, Integer limite, Integer ano) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("inicio", Instant.now().toString());
        out.put("modo", modo);
        if (limite != null) {
            out.put("limite", limite);
        }
        if (ano != null) {
            out.put("anoCnj", ano);
        }
        out.put("timeoutProcessoSegundos", timeoutProcessoSegundos);
        out.put("delayEntreProcessosMs", delayEntreProcessosMs);
        return out;
    }

    private void executarLote(
            List<Long> processoIds, Map<String, Object> out, JobRunContext jobCtx, boolean verificarAcervoIntegral) {
        Instant inicio = Instant.parse(String.valueOf(out.get("inicio")));
        out.put("processosSelecionados", processoIds.size());

        List<Map<String, Object>> porProcesso = new ArrayList<>();
        int criados = 0;
        int atualizados = 0;
        int ignorados = 0;
        int erros = 0;
        int integralizados = 0;
        int acervoIncompleto = 0;

        ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
        try {
            for (int i = 0; i < processoIds.size(); i++) {
                Long processoId = processoIds.get(i);
                if (jobCtx != null) {
                    jobCtx.heartbeatACadaItens(i + 1, 1);
                }

                if (verificarAcervoIntegral) {
                    Map<String, Object> skip = tentarPularAcervoIncompleto(processoId);
                    if (skip != null) {
                        porProcesso.add(skip);
                        if ("ACERVO_INCOMPLETO".equals(skip.get("resultado"))) {
                            acervoIncompleto++;
                        } else {
                            erros++;
                        }
                        ignorados++;
                        aplicarDelay(i, processoIds.size());
                        continue;
                    }
                }

                Map<String, Object> item = processarUm(processoId, executor);
                porProcesso.add(item);

                String tipo = String.valueOf(item.getOrDefault("resultado", ""));
                switch (tipo) {
                    case "CRIADO" -> {
                        criados++;
                        integralizados++;
                    }
                    case "ATUALIZADO" -> {
                        atualizados++;
                        integralizados++;
                    }
                    case "IGNORADO" -> ignorados++;
                    case "ERRO", "TIMEOUT" -> erros++;
                    default -> {}
                }

                aplicarDelay(i, processoIds.size());
            }
        } finally {
            executor.shutdown();
            try {
                if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
                    executor.shutdownNow();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                executor.shutdownNow();
            }
        }

        Instant fim = Instant.now();
        out.put("fim", fim.toString());
        out.put("duracaoTotalMs", Duration.between(inicio, fim).toMillis());
        out.put("processos", porProcesso);
        Map<String, Object> resumo = new LinkedHashMap<>();
        resumo.put("criados", criados);
        resumo.put("atualizados", atualizados);
        resumo.put("integralizados", integralizados);
        resumo.put("ignorados", ignorados);
        resumo.put("acervoIncompleto", acervoIncompleto);
        resumo.put("erros", erros);
        resumo.put("total", porProcesso.size());
        out.put("resumo", resumo);
        if (jobCtx != null) {
            jobCtx.putMetadata(out);
            jobCtx.setItemsProcessed(integralizados);
            jobCtx.setItemsFailed(erros);
        }
        log.info(
                "Backfill consolidado Drive concluído (modo={}): integralizados={}/{} acervoIncompleto={} erros={} duracaoMs={}",
                out.get("modo"),
                integralizados,
                porProcesso.size(),
                acervoIncompleto,
                erros,
                Duration.between(inicio, fim).toMillis());
    }

    private void aplicarDelay(int indice, int total) {
        if (delayEntreProcessosMs > 0 && indice < total - 1) {
            try {
                Thread.sleep(delayEntreProcessosMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private Map<String, Object> tentarPularAcervoIncompleto(Long processoId) {
        var processoOpt = processoRepository.findByIdWithClienteAndPessoa(processoId);
        if (processoOpt.isEmpty()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("processoId", processoId);
            item.put("resultado", "ERRO");
            item.put("erro", "Processo não encontrado");
            return item;
        }
        ProcessoEntity processo = processoOpt.get();
        ProcessoProjudiAcervoIntegralDriveCheckerService.VerificacaoAcervo verificacao =
                acervoIntegralChecker.verificar(processo, credencialIdPadrao);
        if (verificacao.completo()) {
            return null;
        }
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("processoId", processoId);
        item.put("cnj", processo.getNumeroCnj());
        item.put("tramitacao", processo.getTramitacao());
        item.put("totalComDocumento", verificacao.totalComDocumento());
        item.put("totalArquivadasDrive", verificacao.totalArquivadasDrive());
        item.put("faltantes", verificacao.faltantes());
        item.put("resultado", "ACERVO_INCOMPLETO");
        item.put("motivo", verificacao.erro() != null ? verificacao.erro() : "Acervo incompleto no Drive");
        item.put("integralizado", false);
        return item;
    }

    private Map<String, Object> processarUm(Long processoId, ExecutorService executor) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("processoId", processoId);

        var processoOpt = processoRepository.findByIdWithClienteAndPessoa(processoId);
        if (processoOpt.isEmpty()) {
            item.put("resultado", "ERRO");
            item.put("erro", "Processo não encontrado");
            return item;
        }
        var processo = processoOpt.get();
        item.put("cnj", processo.getNumeroCnj());
        item.put("tramitacao", processo.getTramitacao());

        Future<ProcessoMovimentacoesConsolidadoDriveAutoService.ResultadoConsolidadoDrive> future =
                executor.submit(() -> consolidadoDriveAutoService.atualizarConsolidadoNoDrive(processoId, true));

        ProcessoMovimentacoesConsolidadoDriveAutoService.ResultadoConsolidadoDrive resultado;
        try {
            resultado = future.get(timeoutProcessoSegundos, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            item.put("resultado", "TIMEOUT");
            item.put("erro", "Timeout após " + timeoutProcessoSegundos + "s");
            return item;
        } catch (Exception e) {
            item.put("resultado", "ERRO");
            item.put("erro", e.getMessage());
            return item;
        }

        item.put("resultado", resultado.tipo().name());
        item.put("nomeArquivo", resultado.nomeArquivo());
        item.put("driveFileId", resultado.driveFileId());
        item.put("pastaDestinoId", resultado.pastaDestinoId());
        if (resultado.avisos() != null && !resultado.avisos().isEmpty()) {
            item.put("avisos", resultado.avisos());
        }
        if (resultado.mensagemErro() != null) {
            item.put("erro", resultado.mensagemErro());
        }
        item.put(
                "integralizado",
                resultado.tipo() == ProcessoMovimentacoesConsolidadoDriveAutoService.ResultadoTipo.CRIADO
                        || resultado.tipo()
                                == ProcessoMovimentacoesConsolidadoDriveAutoService.ResultadoTipo.ATUALIZADO);
        return item;
    }
}
