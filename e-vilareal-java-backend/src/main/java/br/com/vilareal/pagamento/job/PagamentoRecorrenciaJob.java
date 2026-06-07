package br.com.vilareal.pagamento.job;

import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.pagamento.api.dto.recorrencia.PagamentoRecorrenciaGerarMesResponse;
import br.com.vilareal.pagamento.application.PagamentoRecorrenciaService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.stream.Collectors;

@Component
public class PagamentoRecorrenciaJob {

    private static final Logger log = LoggerFactory.getLogger(PagamentoRecorrenciaJob.class);
    private static final DateTimeFormatter FMT_MES_ANO = DateTimeFormatter.ofPattern("MM/yyyy", Locale.ROOT);

    private final PagamentoRecorrenciaService pagamentoRecorrenciaService;
    private final JobRunTracker jobRunTracker;
    private final Clock clock;

    public PagamentoRecorrenciaJob(
            PagamentoRecorrenciaService pagamentoRecorrenciaService,
            JobRunTracker jobRunTracker,
            Clock clock) {
        this.pagamentoRecorrenciaService = pagamentoRecorrenciaService;
        this.jobRunTracker = jobRunTracker;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 6 1 * ?", zone = "America/Sao_Paulo")
    public void gerarPagamentosRecorrentesMensal() {
        jobRunTracker.runTrackedJobVoid(JobNames.PAGAMENTO_RECORRENCIA, ctx -> {
            String mesAno = LocalDate.now(clock).format(FMT_MES_ANO);
            log.info("Iniciando geração automática de pagamentos recorrentes para {}", mesAno);
            ctx.putMetadata("mesAno", mesAno);

            PagamentoRecorrenciaGerarMesResponse resultado = pagamentoRecorrenciaService.gerarMes(mesAno);
            ctx.setItemsProcessed(resultado.getGerados());
            ctx.setItemsFailed(resultado.getErros());
            ctx.putMetadata("jaExistiam", resultado.getJaExistiam());

            log.info(
                    "Geração concluída: {} gerados, {} já existiam, {} erros",
                    resultado.getGerados(),
                    resultado.getJaExistiam(),
                    resultado.getErros());

            if (resultado.getErros() > 0) {
                log.warn(
                        "Erros na geração: {}",
                        resultado.getDetalhes().stream()
                                .filter(d -> "ERRO".equals(d.getResultado()))
                                .map(d -> d.getDescricao() + ": " + d.getMensagemErro())
                                .collect(Collectors.joining(", ")));
            }
        });
    }
}
