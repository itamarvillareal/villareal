package br.com.vilareal.processo.application;

import br.com.vilareal.jobrun.application.JobRunContext;
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
 * Movimentações Email (origem PROJUDI).
 */
@Service
public class ProcessoMovimentacoesConsolidadoDriveBackfillService {

    private static final Logger log = LoggerFactory.getLogger(ProcessoMovimentacoesConsolidadoDriveBackfillService.class);

    private final PublicacaoRepository publicacaoRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoMovimentacoesConsolidadoDriveAutoService consolidadoDriveAutoService;
    private final int limitePadrao;
    private final int timeoutProcessoSegundos;
    private final long delayEntreProcessosMs;

    public ProcessoMovimentacoesConsolidadoDriveBackfillService(
            PublicacaoRepository publicacaoRepository,
            ProcessoRepository processoRepository,
            ProcessoMovimentacoesConsolidadoDriveAutoService consolidadoDriveAutoService,
            @Value("${vilareal.processo.movimentacoes.consolidado.backfill.limite-padrao:100}")
                    int limitePadrao,
            @Value("${vilareal.processo.movimentacoes.consolidado.backfill.timeout-processo-segundos:300}")
                    int timeoutProcessoSegundos,
            @Value("${vilareal.processo.movimentacoes.consolidado.backfill.delay-ms:200}")
                    long delayEntreProcessosMs) {
        this.publicacaoRepository = publicacaoRepository;
        this.processoRepository = processoRepository;
        this.consolidadoDriveAutoService = consolidadoDriveAutoService;
        this.limitePadrao = limitePadrao > 0 ? limitePadrao : 100;
        this.timeoutProcessoSegundos = timeoutProcessoSegundos > 0 ? timeoutProcessoSegundos : 300;
        this.delayEntreProcessosMs = Math.max(0, delayEntreProcessosMs);
    }

    public Map<String, Object> executarBackfill(Integer limiteInformado) {
        return executarBackfill(limiteInformado, null);
    }

    public Map<String, Object> executarBackfill(Integer limiteInformado, JobRunContext jobCtx) {
        Instant inicio = Instant.now();
        int limite = limiteInformado != null && limiteInformado > 0 ? limiteInformado : limitePadrao;

        List<Long> processoIds =
                publicacaoRepository.findUltimosProcessoIdsMovimentacoesEmailProjudi(limite);
        if (processoIds.isEmpty()) {
            processoIds = publicacaoRepository.findDistinctProcessoIdsComPublicacaoProjudiCnjCompleto().stream()
                    .limit(limite)
                    .toList();
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("inicio", inicio.toString());
        out.put("limite", limite);
        out.put("timeoutProcessoSegundos", timeoutProcessoSegundos);
        out.put("delayEntreProcessosMs", delayEntreProcessosMs);
        out.put("processosSelecionados", processoIds.size());

        List<Map<String, Object>> porProcesso = new ArrayList<>();
        int criados = 0;
        int atualizados = 0;
        int ignorados = 0;
        int erros = 0;
        int integralizados = 0;

        ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
        try {
            for (int i = 0; i < processoIds.size(); i++) {
                Long processoId = processoIds.get(i);
                if (jobCtx != null) {
                    jobCtx.heartbeatACadaItens(i + 1, 1);
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

                if (delayEntreProcessosMs > 0 && i < processoIds.size() - 1) {
                    try {
                        Thread.sleep(delayEntreProcessosMs);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        out.put("paradaAntecipada", "Interrompido entre processos");
                        break;
                    }
                }
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
        out.put("resumo", Map.of(
                "criados", criados,
                "atualizados", atualizados,
                "integralizados", integralizados,
                "ignorados", ignorados,
                "erros", erros,
                "total", porProcesso.size()));
        if (jobCtx != null) {
            jobCtx.putMetadata(out);
            jobCtx.setItemsProcessed(integralizados);
            jobCtx.setItemsFailed(erros);
        }
        log.info(
                "Backfill consolidado Drive concluído: integralizados={}/{} erros={} duracaoMs={}",
                integralizados,
                porProcesso.size(),
                erros,
                Duration.between(inicio, fim).toMillis());
        return out;
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
