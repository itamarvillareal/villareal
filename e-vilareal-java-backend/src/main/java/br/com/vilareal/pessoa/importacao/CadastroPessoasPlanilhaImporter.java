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
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Importa linhas da planilha .xls para {@code pessoa}, {@code pessoa_complementar}, {@code pessoa_endereco},
 * {@code pessoa_contato}. Ver javadoc em {@link CadastroPessoasPlanilhaImportProperties}.
 */
@Service
public class CadastroPessoasPlanilhaImporter {

    private static final Logger log = LoggerFactory.getLogger(CadastroPessoasPlanilhaImporter.class);

    private static final String USUARIO_IMPORT = "importacao-planilha";

    private final JdbcTemplate jdbcTemplate;

    public CadastroPessoasPlanilhaImporter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public ImportStats importar(CadastroPessoasPlanilhaImportProperties props) throws IOException {
        Path path = Path.of(props.getPath());
        if (!Files.isRegularFile(path)) {
            throw new IOException("Arquivo não encontrado: " + path.toAbsolutePath());
        }

        int header0 = Math.max(0, props.getHeaderRow() - 1);
        int dataStart0 = Math.max(0, props.getFirstDataRow() - 1);

        ImportStats stats = new ImportStats();
        DataFormatter fmt = new DataFormatter(Locale.forLanguageTag("pt-BR"));

        try (var in = Files.newInputStream(path);
                Workbook wb = WorkbookFactory.create(in)) {
            Sheet sh = wb.getNumberOfSheets() > 0 ? wb.getSheetAt(0) : null;
            if (sh == null) {
                throw new IOException("Planilha sem abas.");
            }

            Set<String> seenCpf = new HashSet<>();
            Set<String> seenEmailKey = new HashSet<>();

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
                    Optional<String> cpfOpt = CadastroPessoasPlanilhaImportSupport.normalizeCpfCnpj(cpfRaw);
                    if (cpfOpt.isEmpty()) {
                        writeLine(rep, excelRow, String.valueOf(pessoaId), "SKIP", "CPF/CNPJ ausente ou tamanho inválido");
                        stats.skipped++;
                        continue;
                    }
                    String cpf = cpfOpt.get();
                    if (!seenCpf.add(cpf)) {
                        writeLine(rep, excelRow, String.valueOf(pessoaId), "SKIP", "CPF duplicado na planilha (mantida primeira ocorrência)");
                        stats.skipped++;
                        continue;
                    }

                    String emailRaw = CadastroPessoasPlanilhaImportSupport.normalizeEmailForStorage(stringCell(row, 12, fmt));
                    String email = emailRaw;
                    if (!email.isBlank()) {
                        String key = CadastroPessoasPlanilhaImportSupport.emailDuplicateKey(email);
                        if (!seenEmailKey.add(key)) {
                            writeLine(rep, excelRow, String.valueOf(pessoaId), "ADJUST", "E-mail duplicado na planilha; gravando email=NULL");
                            email = "";
                            stats.emailNulled++;
                        }
                    }

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
                            "SELECT COUNT(*) FROM pessoa WHERE id = ?", Long.class, pessoaId);
                    if (exists != null && exists > 0) {
                        writeLine(rep, excelRow, String.valueOf(pessoaId), "SKIP", "ID já existe no banco");
                        stats.skipped++;
                        continue;
                    }

                    Long cpfClash = jdbcTemplate.queryForObject(
                            "SELECT COUNT(*) FROM pessoa WHERE cpf = ?", Long.class, cpf);
                    if (cpfClash != null && cpfClash > 0) {
                        writeLine(rep, excelRow, String.valueOf(pessoaId), "SKIP", "CPF já existe no banco (outro id)");
                        stats.skipped++;
                        continue;
                    }

                    if (!email.isBlank()) {
                        Long emailClash = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM pessoa WHERE LOWER(TRIM(email)) = ?", Long.class,
                                email.toLowerCase(Locale.ROOT));
                        if (emailClash != null && emailClash > 0) {
                            writeLine(rep, excelRow, String.valueOf(pessoaId), "ADJUST", "E-mail já no banco; gravando email=NULL");
                            email = "";
                        }
                    }

                    Timestamp now = Timestamp.from(Instant.now());

                    try {
                        jdbcTemplate.update(
                                """
                                        INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
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
                                """
                                        INSERT INTO pessoa_complementar (pessoa_id, rg, orgao_expedidor, profissao, nacionalidade, estado_civil, genero)
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
                                    """
                                            INSERT INTO pessoa_endereco (pessoa_id, numero_ordem, rua, bairro, estado, cidade, cep, auto_preenchido)
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
                                    """
                                            INSERT INTO pessoa_contato (pessoa_id, tipo, valor, data_lancamento, data_alteracao, usuario_lancamento)
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
                            jdbcTemplate.update("DELETE FROM pessoa WHERE id = ?", pessoaId);
                        } catch (DataAccessException delEx) {
                            log.debug("Rollback parcial: {}", delEx.getMessage());
                        }
                        stats.skipped++;
                    }
                }
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
        Long max = jdbcTemplate.queryForObject("SELECT COALESCE(MAX(id), 0) FROM pessoa", Long.class);
        long next = max == null ? 1L : max + 1L;
        if (next < 1) {
            next = 1;
        }
        jdbcTemplate.execute("ALTER TABLE pessoa AUTO_INCREMENT = " + next);
        log.info("AUTO_INCREMENT de pessoa ajustado para {}", next);
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
