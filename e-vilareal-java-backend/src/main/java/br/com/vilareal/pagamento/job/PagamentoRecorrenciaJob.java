package br.com.vilareal.pagamento.job;

import br.com.vilareal.pagamento.api.dto.recorrencia.PagamentoRecorrenciaGerarMesResponse;
import br.com.vilareal.pagamento.application.PagamentoRecorrenciaService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.stream.Collectors;

@Component
public class PagamentoRecorrenciaJob {

    private static final Logger log = LoggerFactory.getLogger(PagamentoRecorrenciaJob.class);
    private static final DateTimeFormatter FMT_MES_ANO = DateTimeFormatter.ofPattern("MM/yyyy", Locale.ROOT);

    private final PagamentoRecorrenciaService pagamentoRecorrenciaService;

    public PagamentoRecorrenciaJob(PagamentoRecorrenciaService pagamentoRecorrenciaService) {
        this.pagamentoRecorrenciaService = pagamentoRecorrenciaService;
    }

    @Scheduled(cron = "0 0 6 1 * ?", zone = "America/Sao_Paulo")
    public void gerarPagamentosRecorrentesMensal() {
        String mesAno = LocalDate.now().format(FMT_MES_ANO);
        log.info("Iniciando geração automática de pagamentos recorrentes para {}", mesAno);

        PagamentoRecorrenciaGerarMesResponse resultado = pagamentoRecorrenciaService.gerarMes(mesAno);

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
    }
}
