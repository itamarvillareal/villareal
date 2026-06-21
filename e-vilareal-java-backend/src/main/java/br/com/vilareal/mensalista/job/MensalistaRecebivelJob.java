package br.com.vilareal.mensalista.job;

import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.mensalista.api.dto.MensalistaGerarMesResponse;
import br.com.vilareal.mensalista.application.MensalistaApplicationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.stream.Collectors;

@Component
public class MensalistaRecebivelJob {

    private static final Logger log = LoggerFactory.getLogger(MensalistaRecebivelJob.class);
    private static final DateTimeFormatter FMT_MES_REF = DateTimeFormatter.ofPattern("yyyy-MM", Locale.ROOT);

    private final MensalistaApplicationService mensalistaApplicationService;
    private final JobRunTracker jobRunTracker;
    private final Clock clock;

    public MensalistaRecebivelJob(
            MensalistaApplicationService mensalistaApplicationService,
            JobRunTracker jobRunTracker,
            Clock clock) {
        this.mensalistaApplicationService = mensalistaApplicationService;
        this.jobRunTracker = jobRunTracker;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 6 1 * ?", zone = "America/Sao_Paulo")
    public void gerarRecebiveisMensalistasMensal() {
        jobRunTracker.runTrackedJobVoid(JobNames.MENSALISTA_RECEBIVEL, ctx -> {
            String mesReferencia = YearMonth.from(clock.instant().atZone(clock.getZone())).format(FMT_MES_REF);
            log.info("Iniciando geração de recebíveis de mensalistas para {}", mesReferencia);
            ctx.putMetadata("mesReferencia", mesReferencia);

            MensalistaGerarMesResponse resultado = mensalistaApplicationService.gerarMes(mesReferencia);
            ctx.setItemsProcessed(resultado.getGerados());
            ctx.setItemsFailed(resultado.getErros());
            ctx.putMetadata("jaExistiam", resultado.getJaExistiam());
            ctx.putMetadata("ignorados", resultado.getIgnorados());

            log.info(
                    "Geração mensalistas concluída: {} gerados, {} já existiam, {} ignorados, {} erros",
                    resultado.getGerados(),
                    resultado.getJaExistiam(),
                    resultado.getIgnorados(),
                    resultado.getErros());

            if (resultado.getErros() > 0) {
                log.warn(
                        "Erros na geração de mensalistas: {}",
                        resultado.getDetalhes().stream()
                                .filter(d -> "ERRO".equals(d.getResultado()))
                                .map(d -> d.getClienteNome() + ": " + d.getMensagemErro())
                                .collect(Collectors.joining(", ")));
            }
        });
    }
}
