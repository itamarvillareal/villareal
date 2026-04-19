package br.com.vilareal.pessoa.importacao;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Importação da planilha "Cadastro Pessoas" (.xls).
 *
 * <p>Políticas (plano aprovado): linhas sem CPF/CNPJ válido são ignoradas; primeiro e-mail por endereço
 * vence (demais com {@code email} nulo); primeiro CPF na planilha vence (duplicata na planilha ignorada);
 * col. 26/33 ignoradas como dado; col. 4–5 e 29/38 não são mais persistidas em complementar (V34).
 *
 * <p><b>Variáveis de ambiente</b> (binding Spring Boot): {@code VILAREAL_IMPORT_PESSOAS_ENABLED},
 * {@code VILAREAL_IMPORT_PESSOAS_PATH}, {@code VILAREAL_IMPORT_PESSOAS_DRY_RUN}, {@code VILAREAL_IMPORT_PESSOAS_LIMIT},
 * {@code VILAREAL_IMPORT_PESSOAS_REPORT_PATH}, {@code VILAREAL_IMPORT_PESSOAS_HEADER_ROW},
 * {@code VILAREAL_IMPORT_PESSOAS_FIRST_DATA_ROW}. Úteis quando o path tem espaços — evitar
 * {@code -Dspring-boot.run.arguments} com vírgulas, que quebra o parse do {@code enabled}.
 */
@ConfigurationProperties(prefix = "vilareal.import.pessoas")
public class CadastroPessoasPlanilhaImportProperties {

    /** Só executa o runner ao subir a aplicação quando {@code true} (evita import acidental). */
    private boolean enabled = false;

    /** Caminho absoluto do .xls. */
    private String path = "";

    /** Se true, não grava no BD; gera relatório CSV. */
    private boolean dryRun = true;

    /** Arquivo CSV de relatório (linhas ignoradas / ajustes). */
    private String reportPath = "import-pessoas-report.csv";

    /** Máximo de linhas de dados a processar (0 = todas). Útil para validação. */
    private int limit = 0;

    /** Linha Excel do cabeçalho (1-based). */
    private int headerRow = 9;

    /** Primeira linha Excel de dados (1-based). */
    private int firstDataRow = 11;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path == null ? "" : path.trim();
    }

    public boolean isDryRun() {
        return dryRun;
    }

    public void setDryRun(boolean dryRun) {
        this.dryRun = dryRun;
    }

    public String getReportPath() {
        return reportPath;
    }

    public void setReportPath(String reportPath) {
        this.reportPath = reportPath == null ? "import-pessoas-report.csv" : reportPath.trim();
    }

    public int getLimit() {
        return limit;
    }

    public void setLimit(int limit) {
        this.limit = limit;
    }

    public int getHeaderRow() {
        return headerRow;
    }

    public void setHeaderRow(int headerRow) {
        this.headerRow = headerRow;
    }

    public int getFirstDataRow() {
        return firstDataRow;
    }

    public void setFirstDataRow(int firstDataRow) {
        this.firstDataRow = firstDataRow;
    }
}
