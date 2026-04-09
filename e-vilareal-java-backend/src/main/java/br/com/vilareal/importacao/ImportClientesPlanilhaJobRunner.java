package br.com.vilareal.importacao;

import br.com.vilareal.importacao.dto.ImportacaoInformacoesProcessosResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Executa {@link ImportClientesPlanilhaService} e encerra a JVM.
 *
 * <p>Uso (path com espaços via env):
 * <pre>
 * {@code VILAREAL_IMPORT_CLIENTES_PLANILHA_JOB_ENABLED=true} \\
 * {@code VILAREAL_IMPORT_CLIENTES_PLANILHA_PATH="/caminho/import clientes.xlsx"} \\
 * {@code ./mvnw spring-boot:run -Dspring-boot.run.profiles=import-clientes-planilha,dev}
 * </pre>
 */
@Profile("import-clientes-planilha")
@Component
@Order(Integer.MAX_VALUE)
public class ImportClientesPlanilhaJobRunner implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(ImportClientesPlanilhaJobRunner.class);

    private final ImportClientesPlanilhaService importClientesPlanilhaService;
    private final ConfigurableApplicationContext context;

    @Value("${vilareal.import.clientes-planilha.job.enabled:false}")
    private boolean jobEnabled;

    @Value("${vilareal.import.clientes-planilha.path:}")
    private String configuredPath;

    public ImportClientesPlanilhaJobRunner(
            ImportClientesPlanilhaService importClientesPlanilhaService, ConfigurableApplicationContext context) {
        this.importClientesPlanilhaService = importClientesPlanilhaService;
        this.context = context;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (!jobEnabled) {
            log.info(
                    "import-clientes-planilha: vilareal.import.clientes-planilha.job.enabled=false — defina true (ou env VILAREAL_IMPORT_CLIENTES_PLANILHA_JOB_ENABLED=true) para executar.");
            SpringApplication.exit(context, () -> 0);
            return;
        }
        Path path =
                StringUtils.hasText(configuredPath)
                        ? Paths.get(configuredPath.trim())
                        : importClientesPlanilhaService.resolverPathPadrao();
        log.info("import-clientes-planilha: ficheiro={}", path.toAbsolutePath());
        try {
            ImportacaoInformacoesProcessosResponse resp = importClientesPlanilhaService.importarDeArquivo(path);
            log.info(
                    "import-clientes-planilha: sucesso={} erros={} (total linhas corpo folha={})",
                    resp.getLinhasProcessadasComSucesso(),
                    resp.getLinhasComErro(),
                    resp.getTotalLinhasCorpo());
            int code = resp.getLinhasComErro() > 0 ? 1 : 0;
            SpringApplication.exit(context, () -> code);
        } catch (Exception e) {
            log.error("import-clientes-planilha: falha", e);
            SpringApplication.exit(context, () -> 1);
        }
    }
}
