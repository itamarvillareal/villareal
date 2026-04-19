package br.com.vilareal.importacao;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Job único: importar as três planilhas na ordem correta quando {@code vilareal.import.batch.enabled=true}.
 *
 * <p>Variáveis de ambiente: {@code VILAREAL_IMPORT_BATCH_ENABLED}, {@code VILAREAL_IMPORT_BATCH_PATH_PESSOAS},
 * {@code VILAREAL_IMPORT_BATCH_PATH_CLIENTES}, {@code VILAREAL_IMPORT_BATCH_PATH_IMOVEIS},
 * {@code VILAREAL_IMPORT_BATCH_PESSOAS_DRY_RUN}, {@code VILAREAL_IMPORT_BATCH_PESSOAS_REPORT_PATH}.
 */
@ConfigurationProperties(prefix = "vilareal.import.batch")
public class ImportPlanilhasBatchProperties {

    private boolean enabled = false;

    private String pathPessoas = "";
    private String pathClientes = "";
    private String pathImoveis = "";

    /** Igual ao job {@code import-pessoas} isolado; no lote costuma ser {@code false}. */
    private boolean pessoasDryRun = false;

    private String pessoasReportPath = "import-pessoas-batch-report.csv";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getPathPessoas() {
        return pathPessoas;
    }

    public void setPathPessoas(String pathPessoas) {
        this.pathPessoas = pathPessoas == null ? "" : pathPessoas.trim();
    }

    public String getPathClientes() {
        return pathClientes;
    }

    public void setPathClientes(String pathClientes) {
        this.pathClientes = pathClientes == null ? "" : pathClientes.trim();
    }

    public String getPathImoveis() {
        return pathImoveis;
    }

    public void setPathImoveis(String pathImoveis) {
        this.pathImoveis = pathImoveis == null ? "" : pathImoveis.trim();
    }

    public boolean isPessoasDryRun() {
        return pessoasDryRun;
    }

    public void setPessoasDryRun(boolean pessoasDryRun) {
        this.pessoasDryRun = pessoasDryRun;
    }

    public String getPessoasReportPath() {
        return pessoasReportPath;
    }

    public void setPessoasReportPath(String pessoasReportPath) {
        this.pessoasReportPath =
                pessoasReportPath == null || pessoasReportPath.isBlank()
                        ? "import-pessoas-batch-report.csv"
                        : pessoasReportPath.trim();
    }
}
