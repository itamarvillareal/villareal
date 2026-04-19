package br.com.vilareal.importacao;

import br.com.vilareal.importacao.dto.ImportacaoInformacoesProcessosResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import br.com.vilareal.importacao.condition.ImportRunnerNotBatchEnabledCondition;
import org.springframework.context.ApplicationListener;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Importa {@code imoveis.xlsx} e encerra a JVM.
 *
 * <pre>
 * VILAREAL_IMPORT_IMOVEIS_PLANILHA_JOB_ENABLED=true \\
 * VILAREAL_IMPORT_IMOVEIS_PLANILHA_PATH="/caminho/imoveis.xlsx" \\
 * ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev \\
 *   -Dspring-boot.run.jvmArguments="-Dspring.main.web-application-type=none"
 * </pre>
 */
@ConditionalOnProperty(prefix = "vilareal.import.imoveis-planilha.job", name = "enabled", havingValue = "true")
@Conditional(ImportRunnerNotBatchEnabledCondition.class)
@Component
@Order(Integer.MAX_VALUE)
public class ImoveisPlanilhaImportJobRunner implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(ImoveisPlanilhaImportJobRunner.class);

    private final ImoveisPlanilhaImportService imoveisPlanilhaImportService;
    private final ConfigurableApplicationContext context;

    @Value("${vilareal.import.imoveis-planilha.path:}")
    private String configuredPath;

    public ImoveisPlanilhaImportJobRunner(
            ImoveisPlanilhaImportService imoveisPlanilhaImportService, ConfigurableApplicationContext context) {
        this.imoveisPlanilhaImportService = imoveisPlanilhaImportService;
        this.context = context;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        Path path =
                StringUtils.hasText(configuredPath)
                        ? Paths.get(configuredPath.trim())
                        : imoveisPlanilhaImportService.resolverPathPadrao();
        log.info("import-imoveis-planilha: ficheiro={}", path.toAbsolutePath());
        try {
            ImportacaoInformacoesProcessosResponse resp = imoveisPlanilhaImportService.importarDeArquivo(path);
            log.info(
                    "import-imoveis-planilha: sucesso={} erros={} ignoradas={} (último índice folha={})",
                    resp.getLinhasProcessadasComSucesso(),
                    resp.getLinhasComErro(),
                    resp.getLinhasIgnoradas(),
                    resp.getTotalLinhasCorpo());
            int code = resp.getLinhasComErro() > 0 ? 1 : 0;
            SpringApplication.exit(context, () -> code);
        } catch (Exception e) {
            log.error("import-imoveis-planilha: falha", e);
            SpringApplication.exit(context, () -> 1);
        }
    }
}
