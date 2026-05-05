package br.com.vilareal.pessoa.importacao;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Importa linhas da planilha .xls para {@code pessoa}, {@code pessoa_complementar}, {@code pessoa_endereco},
 * {@code pessoa_contato}. Antes de ler, copia o ficheiro de origem para um .xls temporário e remove-o ao terminar
 * (igual ao fluxo do script Python). Ver {@link CadastroPessoasPlanilhaImportProperties}.
 */
@Service
public class CadastroPessoasPlanilhaImporter {

    private static final Logger log = LoggerFactory.getLogger(CadastroPessoasPlanilhaImporter.class);

    private static final String USUARIO_IMPORT = "importacao-planilha";

    /**
     * Sufixo injetado em identificadores de tabela (MySQL 64 chars). Só {@code _ident} seguro — evita SQL injection
     * em sentenças montadas com concatenação.
     */
    private static final Pattern SAFE_TABLE_SUFFIX = Pattern.compile("^_[A-Za-z][A-Za-z0-9_]{0,47}$");

    private static final int LONGEST_BASE_TABLE = "pessoa_complementar".length();

    private final JdbcTemplate jdbcTemplate;

    /** Sufixo opcional (ex.: {@code _nova}) concatenado aos nomes das 4 tabelas de destino. */
    private final String tableSuffix;
    private final String tblPessoa;
    private final String tblComplementar;
    private final String tblEndereco;
    private final String tblContato;

    public CadastroPessoasPlanilhaImporter(
            JdbcTemplate jdbcTemplate,
            @Value("${vilareal.import.pessoas.table-suffix:}") String tableSuffix) {
        this.jdbcTemplate = jdbcTemplate;
        this.tableSuffix = normalizeAndValidateTableSuffix(tableSuffix);
        this.tblPessoa = "pessoa" + this.tableSuffix;
        this.tblComplementar = "pessoa_complementar" + this.tableSuffix;
        this.tblEndereco = "pessoa_endereco" + this.tableSuffix;
        this.tblContato = "pessoa_contato" + this.tableSuffix;
    }

    /**
     * @return vazio (tabelas canónicas) ou sufixo no formato {@code _nome} (ex. {@code _nova}).
     */
    static String normalizeAndValidateTableSuffix(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String s = raw.trim();
        if (!SAFE_TABLE_SUFFIX.matcher(s).matches()) {
            throw new IllegalArgumentException(
                    "vilareal.import.pessoas.table-suffix must be empty or like '_nova' (underscore, letter, then"
                            + " letters/digits/underscores only, max 48 chars after '_'), got: "
                            + s);
        }
        if (LONGEST_BASE_TABLE + s.length() > 64) {
            throw new IllegalArgumentException("vilareal.import.pessoas.table-suffix: resulting table name would exceed"
                    + " MySQL 64-char limit");
        }
        return s;
    }

    public ImportStats importar(CadastroPessoasPlanilhaImportProperties props) throws IOException {
        log.info("Importando para tabelas com sufixo: '{}'", tableSuffix);

        Path origem = Path.of(props.getPath()).toAbsolutePath().normalize();
        if (!Files.isRegularFile(origem)) {
            throw new IOException("Arquivo não encontrado: " + origem);
        }

        int header0 = Math.max(0, props.getHeaderRow() - 1);
        int dataStart0 = Math.max(0, props.getFirstDataRow() - 1);

        ImportStats stats = new ImportStats();
        DataFormatter fmt = new DataFormatter(Locale.forLanguageTag("pt-BR"));

        Path copiaTrabalho = Files.createTempFile("cadastro_pessoas_import_", ".xls");
        try {
            Files.copy(origem, copiaTrabalho, StandardCopyOption.REPLACE_EXISTING);
            log.info("Planilha copiada para ficheiro local de trabalho (será removido ao terminar): {}", copiaTrabalho);

            try (var in = Files.newInputStream(copiaTrabalho);
                    Workbook wb = WorkbookFactory.create(in)) {
            Sheet sh = wb.getNumberOfSheets() > 0 ? wb.getSheetAt(0) : null;
            if (sh == null) {
                throw new IOException("Planilha sem abas.");
            }

            Set<String> seenCpf = new HashSet<>();

            try (BufferedWriter rep = openReport(props.getReportPath())) {
                rep.write("excel_row,planilha_id,tipo,mensagem\n");

                if (header0 <= sh.getLastRowNum()) {
                    Row h = sh.getRow(header0);
                    if (h != null) {
                        String h0 = stringCell(h, 0, fmt);
                        if (!"ID".equalsIgnoreCase(h0.trim())) {
                            log.warn("Célula A{} não parece cabeçalho 'ID' (encontrado: {})", header0 + 1, h0);
                        }
                    }
                }

                int processed = 0;
                for (int r = dataStart0; r <= sh.getLastRowNum(); r++) {
                    if (props.getLimit() > 0 && processed >= props.getLimit()) {
                        break;
                    }
                    Row row = sh.getRow(r);
                    int excelRow = r + 1;
                    if (row == null) {
                        continue;
                    }

                    Optional<Long> idOpt = readLongId(row, 0);
                    if (idOpt.isEmpty()) {
                        writeLine(rep, excelRow, "", "SKIP", "ID inválido ou vazio");
                        stats.skipped++;
                        continue;
                    }
                    long pessoaId = idOpt.get();

                    String nome = CadastroPessoasPlanilhaImportSupport.truncate(stringCell(row, 1, fmt), 255);
                    if (nome.isBlank()) {
                        writeLine(rep, excelRow, String.valueOf(pessoaId), "SKIP", "Nome vazio");
                        stats.skipped++;
                        continue;
                    }

                    String cpfRaw = stringCell(row, 3, fmt);
                    CadastroPessoasPlanilhaImportSupport.CpfCnpjNormalizado cpfNorm =
                            CadastroPessoasPlanilhaImportSupport.analisarCpfCnpj(cpfRaw);
                    String cpf = null;
                    if (cpfNorm.resultado() == CadastroPessoasPlanilhaImportSupport.CpfCnpjResultado.INVALIDO) {
                        writeLine(
                                rep,
                                excelRow,
                                String.valueOf(pessoaId),
                                "SKIP",
                                "CPF/CNPJ com formato invalido (esperado 11 ou 14 digitos)");
                        stats.skipped++;
                        continue;
                    }
                    if (cpfNorm.resultado() == CadastroPessoasPlanilhaImportSupport.CpfCnpjResultado.VALIDO) {
                        cpf = cpfNorm.valor();
                        if (!seenCpf.add(cpf)) {
                            writeLine(
                                    rep,
                                    excelRow,
                                    String.valueOf(pessoaId),
                                    "SKIP",
                                    "CPF duplicado na planilha (mantida primeira ocorrência)");
                            stats.skipped++;
                            continue;
                        }
                    }

                    String emailRaw = CadastroPessoasPlanilhaImportSupport.normalizeEmailForStorage(stringCell(row, 12, fmt));
                    String email = emailRaw;

                    LocalDate dataNasc = readDataNascimento(row, 8, fmt);

                    String telefonePrincipal = pickPrincipalTelefone(row, fmt);
                    String telPessoaCol = CadastroPessoasPlanilhaImportSupport.digitsOnly(telefonePrincipal);
                    if (telPessoaCol.isEmpty()) {
                        telPessoaCol = CadastroPessoasPlanilhaImportSupport.truncate(telefonePrincipal, 40);
                    } else {
                        telPessoaCol = CadastroPessoasPlanilhaImportSupport.truncate(telPessoaCol, 40);
                    }

                    String genero = CadastroPessoasPlanilhaImportSupport.truncate(stringCell(row, 2, fmt), 8);
                    String rg = CadastroPessoasPlanilhaImportSupport.truncate(stringCell(row, 6, fmt), 40);
                    String orgaoRg = CadastroPessoasPlanilhaImportSupport.truncate(stringCell(row, 7, fmt), 120);
                    String nacionalidade = CadastroPessoasPlanilhaImportSupport.truncate(stringCell(row, 9, fmt), 120);
                    String estadoCivil = CadastroPessoasPlanilhaImportSupport.truncate(stringCell(row, 10, fmt), 40);
                    String profissao = CadastroPessoasPlanilhaImportSupport.truncate(stringCell(row, 11, fmt), 255);

                    // colunas 4–5, 29 e 38 (Adm PJ / anomalias): removido em V34 — não gravar em pessoa_complementar

                    String rua = CadastroPessoasPlanilhaImportSupport.truncate(stringCell(row, 17, fmt), 255);
                    String bairro = CadastroPessoasPlanilhaImportSupport.truncate(stringCell(row, 13, fmt), 120);
                    String uf = CadastroPessoasPlanilhaImportSupport.normalizeUf(stringCell(row, 14, fmt));
                    uf = CadastroPessoasPlanilhaImportSupport.truncate(uf, 2);
                    String cidade = CadastroPessoasPlanilhaImportSupport.truncate(stringCell(row, 15, fmt), 120);
                    String cep = CadastroPessoasPlanilhaImportSupport.normalizeCep(stringCell(row, 16, fmt));
                    cep = CadastroPessoasPlanilhaImportSupport.truncate(cep, 8);

                    List<TelefoneSlot> slots = readTelefoneSlots(row, fmt);

                    processed++;

                    if (props.isDryRun()) {
                        stats.wouldInsert++;
                        log.debug("DRY-RUN row {} id {}", excelRow, pessoaId);
                        continue;
                    }

                    Long exists = jdbcTemplate.queryForObject(
                            "SELECT COUNT(*) FROM " + tblPessoa + " WHERE id = ?", Long.class, pessoaId);
                    if (exists != null && exists > 0) {
                        writeLine(rep, excelRow, String.valueOf(pessoaId), "SKIP", "ID já existe no banco");
                        stats.skipped++;
                        continue;
                    }

                    if (cpf != null) {
                        Long cpfClash = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM " + tblPessoa + " WHERE cpf = ?", Long.class, cpf);
                        if (cpfClash != null && cpfClash > 0) {
                            writeLine(rep, excelRow, String.valueOf(pessoaId), "SKIP", "CPF já existe no banco (outro id)");
                            stats.skipped++;
                            continue;
                        }
                    }

                    Timestamp now = Timestamp.from(Instant.now());

                    try {
                        jdbcTemplate.update(
                                "INSERT INTO "
                                        + tblPessoa
                                        + """
                                         (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
                                        VALUES (?,?,?,?,?,?,TRUE,FALSE,NULL,?,?)
                                        """,
                                pessoaId,
                                nome,
                                cpf,
                                email.isBlank() ? null : email,
                                telPessoaCol.isBlank() ? null : telPessoaCol,
                                dataNasc,
                                now,
                                now);

                        jdbcTemplate.update(
                                "INSERT INTO "
                                        + tblComplementar
                                        + """
                                         (pessoa_id, rg, orgao_expedidor, profissao, nacionalidade, estado_civil, genero)
                                        VALUES (?,?,?,?,?,?,?)
                                        """,
                                pessoaId,
                                rg.isBlank() ? null : rg,
                                orgaoRg.isBlank() ? null : orgaoRg,
                                profissao.isBlank() ? null : profissao,
                                nacionalidade.isBlank() ? null : nacionalidade,
                                estadoCivil.isBlank() ? null : estadoCivil,
                                genero.isBlank() ? null : genero);

                        if (!rua.isBlank()) {
                            jdbcTemplate.update(
                                    "INSERT INTO "
                                            + tblEndereco
                                            + """
                                             (pessoa_id, numero_ordem, rua, bairro, estado, cidade, cep, auto_preenchido)
                                            VALUES (?,?,?,?,?,?,?,FALSE)
                                            """,
                                    pessoaId,
                                    1,
                                    rua,
                                    bairro.isBlank() ? null : bairro,
                                    uf.isBlank() ? null : uf,
                                    cidade.isBlank() ? null : cidade,
                                    cep.isBlank() ? null : cep);
                        }

                        for (TelefoneSlot sl : slots) {
                            String valor = CadastroPessoasPlanilhaImportSupport.mergeTelefoneValor(sl.tel(), sl.inf());
                            if (valor.isBlank()) {
                                continue;
                            }
                            jdbcTemplate.update(
                                    "INSERT INTO "
                                            + tblContato
                                            + """
                                             (pessoa_id, tipo, valor, data_lancamento, data_alteracao, usuario_lancamento)
                                            VALUES (?,?,?,?,?,?)
                                            """,
                                    pessoaId,
                                    "telefone",
                                    valor,
                                    now,
                                    now,
                                    USUARIO_IMPORT);
                        }

                        stats.inserted++;
                    } catch (DataAccessException ex) {
                        log.warn("Falha na linha Excel {} pessoa id {}: {}", excelRow, pessoaId, ex.getMessage());
                        writeLine(rep, excelRow, String.valueOf(pessoaId), "ERROR", truncateMsg(ex.getMessage()));
                        try {
                            jdbcTemplate.update("DELETE FROM " + tblPessoa + " WHERE id = ?", pessoaId);
                        } catch (DataAccessException delEx) {
                            log.debug("Rollback parcial: {}", delEx.getMessage());
                        }
                        stats.skipped++;
                    }
                }
            }
            }
        } finally {
            try {
                Files.deleteIfExists(copiaTrabalho);
            } catch (IOException ex) {
                log.warn("Não foi possível remover cópia temporária da planilha {}: {}", copiaTrabalho, ex.getMessage());
            }
        }

        if (!props.isDryRun() && stats.inserted > 0) {
            realinharAutoIncrementPessoa();
        }

        log.info(
                "Importação pessoas concluída: inseridas={}, candidatas_dry_run={}, ignoradas={}, emails_anulados_planilha={}, dryRun={}",
                stats.inserted,
                stats.wouldInsert,
                stats.skipped,
                stats.emailNulled,
                props.isDryRun());

        return stats;
    }

    private void realinharAutoIncrementPessoa() {
        Long max = jdbcTemplate.queryForObject("SELECT COALESCE(MAX(id), 0) FROM " + tblPessoa, Long.class);
        long next = max == null ? 1L : max + 1L;
        if (next < 1) {
            next = 1;
        }
        jdbcTemplate.execute("ALTER TABLE " + tblPessoa + " AUTO_INCREMENT = " + next);
        log.info("AUTO_INCREMENT de {} ajustado para {}", tblPessoa, next);
    }

    private static BufferedWriter openReport(String reportPath) throws IOException {
        Path p = Path.of(reportPath).toAbsolutePath().normalize();
        Path parent = p.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        return Files.newBufferedWriter(p, StandardCharsets.UTF_8);
    }

    private static String truncateMsg(String m) {
        if (m == null) {
            return "";
        }
        return m.length() > 500 ? m.substring(0, 500) : m;
    }

    private static void writeLine(BufferedWriter w, int excelRow, String planilhaId, String tipo, String msg)
            throws IOException {
        w.write(csv(String.valueOf(excelRow)));
        w.write(',');
        w.write(csv(planilhaId));
        w.write(',');
        w.write(csv(tipo));
        w.write(',');
        w.write(csv(msg));
        w.newLine();
    }

    private static String csv(String s) {
        if (s == null) {
            return "";
        }
        if (s.contains(",") || s.contains("\n") || s.contains("\"")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    private record TelefoneSlot(String tel, String inf) {}

    private List<TelefoneSlot> readTelefoneSlots(Row row, DataFormatter fmt) {
        List<TelefoneSlot> out = new ArrayList<>(4);
        int[][] pairs = {{18, 19}, {20, 21}, {22, 23}, {24, 25}};
        for (int[] p : pairs) {
            String tel = stringCell(row, p[0], fmt).trim();
            String inf = stringCell(row, p[1], fmt).trim();
            if (!tel.isEmpty() || !inf.isEmpty()) {
                out.add(new TelefoneSlot(tel, inf));
            }
        }
        return out;
    }

    private String pickPrincipalTelefone(Row row, DataFormatter fmt) {
        List<TelefoneSlot> slots = readTelefoneSlots(row, fmt);
        for (TelefoneSlot s : slots) {
            if (!s.tel().isEmpty()) {
                return s.tel();
            }
        }
        return "";
    }

    private LocalDate readDataNascimento(Row row, int col, DataFormatter fmt) {
        Cell c = row.getCell(col);
        if (c == null) {
            return null;
        }
        try {
            if (c.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(c)) {
                return CadastroPessoasPlanilhaImportSupport.excelDateToLocalDate(c.getNumericCellValue(), true);
            }
        } catch (Exception ignored) {
            return null;
        }
        String s = stringCell(row, col, fmt).trim();
        if (s.isEmpty()) {
            return null;
        }
        return null;
    }

    private Optional<Long> readLongId(Row row, int col) {
        Cell c = row.getCell(col);
        if (c == null) {
            return Optional.empty();
        }
        try {
            if (c.getCellType() == CellType.NUMERIC) {
                double v = c.getNumericCellValue();
                if (v < 1 || v > Long.MAX_VALUE) {
                    return Optional.empty();
                }
                return Optional.of((long) v);
            }
            if (c.getCellType() == CellType.STRING) {
                String t = c.getStringCellValue().trim().replaceAll("\\D+", "");
                if (t.isEmpty()) {
                    return Optional.empty();
                }
                return Optional.of(Long.parseLong(t));
            }
            if (c.getCellType() == CellType.FORMULA) {
                CellType ct = c.getCachedFormulaResultType();
                if (ct == CellType.NUMERIC) {
                    double v = c.getNumericCellValue();
                    if (v < 1 || v > Long.MAX_VALUE) {
                        return Optional.empty();
                    }
                    return Optional.of((long) v);
                }
                if (ct == CellType.STRING) {
                    String t = c.getStringCellValue().trim().replaceAll("\\D+", "");
                    if (t.isEmpty()) {
                        return Optional.empty();
                    }
                    return Optional.of(Long.parseLong(t));
                }
            }
        } catch (Exception ignored) {
            return Optional.empty();
        }
        return Optional.empty();
    }

    private String stringCell(Row row, int colIndex, DataFormatter fmt) {
        Cell c = row.getCell(colIndex);
        if (c == null) {
            return "";
        }
        try {
            return switch (c.getCellType()) {
                case STRING -> nullToEmpty(c.getStringCellValue());
                case BOOLEAN -> c.getBooleanCellValue() ? "TRUE" : "FALSE";
                case NUMERIC -> {
                    if (DateUtil.isCellDateFormatted(c)) {
                        LocalDate d = CadastroPessoasPlanilhaImportSupport.excelDateToLocalDate(c.getNumericCellValue(), true);
                        yield d == null ? "" : d.toString();
                    }
                    double v = c.getNumericCellValue();
                    if (v == Math.rint(v) && v >= Long.MIN_VALUE && v <= Long.MAX_VALUE) {
                        yield String.valueOf((long) v);
                    }
                    yield String.valueOf(v);
                }
                case FORMULA -> {
                    CellType ct = c.getCachedFormulaResultType();
                    if (ct == CellType.STRING) {
                        yield nullToEmpty(c.getStringCellValue());
                    }
                    if (ct == CellType.NUMERIC) {
                        if (DateUtil.isCellDateFormatted(c)) {
                            LocalDate d = CadastroPessoasPlanilhaImportSupport.excelDateToLocalDate(c.getNumericCellValue(), true);
                            yield d == null ? "" : d.toString();
                        }
                        double v = c.getNumericCellValue();
                        if (v == Math.rint(v)) {
                            yield String.valueOf((long) v);
                        }
                        yield String.valueOf(v);
                    }
                    if (ct == CellType.BOOLEAN) {
                        yield c.getBooleanCellValue() ? "TRUE" : "FALSE";
                    }
                    yield fmt.formatCellValue(c);
                }
                default -> fmt.formatCellValue(c);
            };
        } catch (Exception e) {
            return "";
        }
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    public static final class ImportStats {
        /** Linhas gravadas com sucesso (somente quando dryRun=false). */
        public int inserted;
        /** Linhas que seriam gravadas em dry-run. */
        public int wouldInsert;
        public int skipped;
        public int emailNulled;
    }
}
