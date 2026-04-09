package br.com.vilareal.importacao;

import br.com.vilareal.importacao.dto.ImportacaoInformacoesProcessosResponse;
import br.com.vilareal.pessoa.importacao.CadastroPessoasPlanilhaImportProperties;
import br.com.vilareal.pessoa.importacao.CadastroPessoasPlanilhaImporter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Executa em sequência: Cadastro Pessoas (.xls) → import clientes (.xlsx) → imoveis (.xlsx), e encerra a JVM.
 *
 * <p>Não substitui Flyway para <em>dados</em> (paths locais e binários); use após migrações de esquema. Ver
 * {@code scripts/run-import-planilhas-batch.sh} e {@code db/migration/V17__nota_carga_planilhas_batch.sql}.
 *
 * <pre>
 * VILAREAL_IMPORT_BATCH_ENABLED=true \\
 * VILAREAL_IMPORT_BATCH_PATH_PESSOAS="/caminho/Cadastro Pessoas.xls" \\
 * VILAREAL_IMPORT_BATCH_PATH_CLIENTES="/caminho/import clientes.xlsx" \\
 * VILAREAL_IMPORT_BATCH_PATH_IMOVEIS="/caminho/imoveis.xlsx" \\
 * ./mvnw spring-boot:run -Dspring-boot.run.profiles=import-planilhas-batch,dev
 * </pre>
 */
@Profile("import-planilhas-batch")
@Component
@Order(Integer.MAX_VALUE)
public class ImportPlanilhasBatchJobRunner implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(ImportPlanilhasBatchJobRunner.class);

    private final ImportPlanilhasBatchProperties batchProperties;
    private final CadastroPessoasPlanilhaImporter cadastroPessoasPlanilhaImporter;
    private final ImportClientesPlanilhaService importClientesPlanilhaService;
    private final ImoveisPlanilhaImportService imoveisPlanilhaImportService;
    private final ConfigurableApplicationContext context;

    public ImportPlanilhasBatchJobRunner(
            ImportPlanilhasBatchProperties batchProperties,
            CadastroPessoasPlanilhaImporter cadastroPessoasPlanilhaImporter,
            ImportClientesPlanilhaService importClientesPlanilhaService,
            ImoveisPlanilhaImportService imoveisPlanilhaImportService,
            ConfigurableApplicationContext context) {
        this.batchProperties = batchProperties;
        this.cadastroPessoasPlanilhaImporter = cadastroPessoasPlanilhaImporter;
        this.importClientesPlanilhaService = importClientesPlanilhaService;
        this.imoveisPlanilhaImportService = imoveisPlanilhaImportService;
        this.context = context;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (!batchProperties.isEnabled()) {
            log.info(
                    "import-planilhas-batch: vilareal.import.batch.enabled=false — defina true (ou VILAREAL_IMPORT_BATCH_ENABLED=true).");
            SpringApplication.exit(context, () -> 0);
            return;
        }

        if (!StringUtils.hasText(batchProperties.getPathPessoas())
                || !StringUtils.hasText(batchProperties.getPathClientes())
                || !StringUtils.hasText(batchProperties.getPathImoveis())) {
            log.error(
                    "import-planilhas-batch: paths incompletos (path-pessoas, path-clientes, path-imoveis obrigatórios).");
            SpringApplication.exit(context, () -> 1);
            return;
        }

        Path pPessoas = Paths.get(batchProperties.getPathPessoas());
        Path pClientes = Paths.get(batchProperties.getPathClientes());
        Path pImoveis = Paths.get(batchProperties.getPathImoveis());
        for (Path p : new Path[] {pPessoas, pClientes, pImoveis}) {
            if (!Files.isRegularFile(p)) {
                log.error("import-planilhas-batch: arquivo não encontrado: {}", p.toAbsolutePath());
                SpringApplication.exit(context, () -> 1);
                return;
            }
        }

        try {
            log.info("import-planilhas-batch: (1/3) Cadastro Pessoas — {}", pPessoas.toAbsolutePath());
            CadastroPessoasPlanilhaImportProperties pessoasProps = new CadastroPessoasPlanilhaImportProperties();
            pessoasProps.setPath(pPessoas.toString());
            pessoasProps.setDryRun(batchProperties.isPessoasDryRun());
            pessoasProps.setLimit(0);
            pessoasProps.setHeaderRow(9);
            pessoasProps.setFirstDataRow(11);
            pessoasProps.setReportPath(batchProperties.getPessoasReportPath());
            CadastroPessoasPlanilhaImporter.ImportStats st = cadastroPessoasPlanilhaImporter.importar(pessoasProps);
            log.info(
                    "import-planilhas-batch: pessoas ok — inseridas={}, dry_run_candidatas={}, ignoradas={}, email_anulado_planilha={}",
                    st.inserted,
                    st.wouldInsert,
                    st.skipped,
                    st.emailNulled);

            int exitCode = 0;

            log.info("import-planilhas-batch: (2/3) Import clientes — {}", pClientes.toAbsolutePath());
            ImportacaoInformacoesProcessosResponse rCli = importClientesPlanilhaService.importarDeArquivo(pClientes);
            log.info(
                    "import-planilhas-batch: clientes — sucesso={} erros={}",
                    rCli.getLinhasProcessadasComSucesso(),
                    rCli.getLinhasComErro());
            if (rCli.getLinhasComErro() > 0) {
                exitCode = 1;
                log.warn("import-planilhas-batch: clientes com linhas em erro — prosseguindo para imóveis.");
            }

            log.info("import-planilhas-batch: (3/3) Imóveis — {}", pImoveis.toAbsolutePath());
            ImportacaoInformacoesProcessosResponse rImv = imoveisPlanilhaImportService.importarDeArquivo(pImoveis);
            log.info(
                    "import-planilhas-batch: imóveis — sucesso={} erros={} ignoradas={}",
                    rImv.getLinhasProcessadasComSucesso(),
                    rImv.getLinhasComErro(),
                    rImv.getLinhasIgnoradas());
            if (rImv.getLinhasComErro() > 0) {
                exitCode = 1;
            }

            final int finalExit = exitCode;
            SpringApplication.exit(context, () -> finalExit);
        } catch (Exception e) {
            log.error("import-planilhas-batch: falha", e);
            SpringApplication.exit(context, () -> 1);
        }
    }
}
