package br.com.vilareal.imovel.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Backfill do repasse interno de imóvel próprio e encerra a JVM. Exercita o MESMO código de produção
 * do gatilho (não SQL manual): vincula os aluguéis e gera o par de repasse interno.
 *
 * <pre>
 * VILAREAL_BACKFILL_REPASSE_INTERNO_ENABLED=true \
 * VILAREAL_BACKFILL_REPASSE_INTERNO_CONTRATO_ID=43 \
 * ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev \
 *   -Dspring-boot.run.jvmArguments="-Dspring.main.web-application-type=none"
 * </pre>
 */
@ConditionalOnProperty(prefix = "vilareal.backfill.repasse-interno", name = "enabled", havingValue = "true")
@Component
@Order(Integer.MAX_VALUE)
public class RepasseInternoBackfillRunner implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(RepasseInternoBackfillRunner.class);

    private final LocacaoReconciliacaoService reconciliacaoService;
    private final ConfigurableApplicationContext context;

    @Value("${vilareal.backfill.repasse-interno.contrato-id:43}")
    private Long contratoId;

    public RepasseInternoBackfillRunner(
            LocacaoReconciliacaoService reconciliacaoService, ConfigurableApplicationContext context) {
        this.reconciliacaoService = reconciliacaoService;
        this.context = context;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        log.info("backfill-repasse-interno: contrato={}", contratoId);
        try {
            int vinculados = reconciliacaoService.backfillRepasseInternoContrato(contratoId);
            log.info("backfill-repasse-interno: sucesso — aluguéis vinculados/processados={}", vinculados);
            SpringApplication.exit(context, () -> 0);
        } catch (Exception e) {
            log.error("backfill-repasse-interno: falha", e);
            SpringApplication.exit(context, () -> 1);
        }
    }
}
