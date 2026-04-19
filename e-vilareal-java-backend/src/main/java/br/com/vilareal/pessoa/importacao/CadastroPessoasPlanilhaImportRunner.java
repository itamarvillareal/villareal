package br.com.vilareal.pessoa.importacao;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import br.com.vilareal.importacao.condition.ImportRunnerNotBatchEnabledCondition;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Executa a importação e encerra a JVM (adequado a job pontual).
 *
 * <p>Uso (exemplo):
 * <pre>
 * Variáveis de ambiente (evita problemas com espaços no path e vírgulas no Maven):<br>
 * {@code VILAREAL_IMPORT_PESSOAS_ENABLED=true}, {@code VILAREAL_IMPORT_PESSOAS_PATH}, {@code VILAREAL_IMPORT_PESSOAS_DRY_RUN}, {@code VILAREAL_IMPORT_PESSOAS_LIMIT}.<br>
 * Depois: {@code ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev} com
 * {@code -Dspring-boot.run.jvmArguments="-Dspring.main.web-application-type=none"} (ver script {@code run-import-pessoas.sh}).
 * </pre>
 */
@ConditionalOnProperty(prefix = "vilareal.import.pessoas", name = "enabled", havingValue = "true")
@Conditional(ImportRunnerNotBatchEnabledCondition.class)
@Component
@Order(Integer.MAX_VALUE)
public class CadastroPessoasPlanilhaImportRunner implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(CadastroPessoasPlanilhaImportRunner.class);

    private final CadastroPessoasPlanilhaImportProperties properties;
    private final CadastroPessoasPlanilhaImporter importer;
    private final ConfigurableApplicationContext context;

    public CadastroPessoasPlanilhaImportRunner(
            CadastroPessoasPlanilhaImportProperties properties,
            CadastroPessoasPlanilhaImporter importer,
            ConfigurableApplicationContext context) {
        this.properties = properties;
        this.importer = importer;
        this.context = context;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (properties.getPath() == null || properties.getPath().isBlank()) {
            log.error("import-pessoas: enabled=true mas path vazio.");
            SpringApplication.exit(context, () -> 1);
            return;
        }
        try {
            CadastroPessoasPlanilhaImporter.ImportStats stats = importer.importar(properties);
            log.info(
                    "Resumo: inseridas={}, dry_run_candidatas={}, ignoradas={}, email_anulado_planilha={}",
                    stats.inserted,
                    stats.wouldInsert,
                    stats.skipped,
                    stats.emailNulled);
            SpringApplication.exit(context, () -> 0);
        } catch (Exception e) {
            log.error("Falha na importação de pessoas", e);
            SpringApplication.exit(context, () -> 1);
        }
    }
}
