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

            /** Evita repetir a mesma combinação CPF/CNPJ + id da planilha na mesma importação (não bloqueia dois ids distintos com o mesmo CNPJ). */
            Set<String> vistoChaveCpfIdPlanilha = new HashSet<>();

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

                int lastDataRow0 = lastDataRowIndex(sh, dataStart0, fmt);
                log.info(
                        "Linhas de dados: Excel {}–{} (última linha com ID ou nome: {})",
                        dataStart0 + 1,
                        lastDataRow0 + 1,
                        lastDataRow0 + 1);

                int processed = 0;
                for (int r = dataStart0; r <= lastDataRow0; r++) {
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

                    String nome =
                            CadastroPessoasPlanilhaImportSupport.normalizeNomeCadastro(stringCell(row, 1, fmt));
                    if (nome.isBlank()) {
                        writeLine(rep, excelRow, String.valueOf(pessoaId), "SKIP", "Nome vazio");
                        stats.skipped++;
                        continue;
                    }

                    String cpfRaw =
                            CadastroPessoasPlanilhaImportSupport.corrigirMojibakePlanilhaUtf8(stringCell(row, 3, fmt));
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
                        String chaveLinha = cpf + "\0#" + pessoaId;
                        if (!vistoChaveCpfIdPlanilha.add(chaveLinha)) {
                            writeLine(
                                    rep,
                                    excelRow,
                                    String.valueOf(pessoaId),
                                    "SKIP",
                                    "Linha duplicada na planilha (mesmo CPF/CNPJ e mesmo ID de planilha)");
                            stats.skipped++;
                            continue;
                        }
                    }

                    String emailRaw = CadastroPessoasPlanilhaImportSupport.normalizeEmailForStorage(
                            CadastroPessoasPlanilhaImportSupport.corrigirMojibakePlanilhaUtf8(stringCell(row, 12, fmt)));
                    String email = emailRaw;

                    LocalDate dataNasc = readDataNascimento(row, 8, fmt);

                    String telefonePrincipal = pickPrincipalTelefone(row, fmt);
                    String telPessoaCol = CadastroPessoasPlanilhaImportSupport.digitsOnly(telefonePrincipal);
                    if (telPessoaCol.isEmpty()) {
                        telPessoaCol = CadastroPessoasPlanilhaImportSupport.truncate(telefonePrincipal, 40);
                    } else {
                        telPessoaCol = CadastroPessoasPlanilhaImportSupport.truncate(telPessoaCol, 40);
                    }

                    String genero = CadastroPessoasPlanilhaImportSupport.truncatePlanilhaTexto(stringCell(row, 2, fmt), 8);
                    String rg = CadastroPessoasPlanilhaImportSupport.truncatePlanilhaTexto(stringCell(row, 6, fmt), 40);
                    String orgaoRg = CadastroPessoasPlanilhaImportSupport.truncatePlanilhaTexto(stringCell(row, 7, fmt), 120);
                    String nacionalidade =
                            CadastroPessoasPlanilhaImportSupport.truncatePlanilhaTexto(stringCell(row, 9, fmt), 120);
                    String estadoCivil =
                            CadastroPessoasPlanilhaImportSupport.truncatePlanilhaTexto(stringCell(row, 10, fmt), 40);
                    String profissao =
                            CadastroPessoasPlanilhaImportSupport.truncatePlanilhaTexto(stringCell(row, 11, fmt), 255);

                    // colunas 4–5, 29 e 38 (Adm PJ / anomalias): removido em V34 — não gravar em pessoa_complementar

                    String rua = CadastroPessoasPlanilhaImportSupport.truncatePlanilhaTexto(stringCell(row, 17, fmt), 255);
                    String bairro = CadastroPessoasPlanilhaImportSupport.truncatePlanilhaTexto(stringCell(row, 13, fmt), 120);
                    String uf = CadastroPessoasPlanilhaImportSupport.normalizeUf(
                            CadastroPessoasPlanilhaImportSupport.corrigirMojibakePlanilhaUtf8(stringCell(row, 14, fmt)));
                    uf = CadastroPessoasPlanilhaImportSupport.truncate(uf, 2);
                    String cidade = CadastroPessoasPlanilhaImportSupport.truncatePlanilhaTexto(stringCell(row, 15, fmt), 120);
                    String cep = CadastroPessoasPlanilhaImportSupport.normalizeCep(
                            CadastroPessoasPlanilhaImportSupport.corrigirMojibakePlanilhaUtf8(stringCell(row, 16, fmt)));
                    cep = CadastroPessoasPlanilhaImportSupport.truncate(cep, 8);

                    List<TelefoneSlot> slots = readTelefoneSlots(row, fmt);

                    processed++;

                    if (props.isDryRun()) {
                        Long existsDry =
                                jdbcTemplate.queryForObject(
                                        "SELECT COUNT(*) FROM " + tblPessoa + " WHERE id = ?",
                                        Long.class,
                                        pessoaId);
                        boolean idExisteDry = existsDry != null && existsDry > 0;
                        if (idExisteDry) {
                            if (props.isUpdateExisting()) {
                                stats.wouldUpdate++;
                            } else {
                                stats.skipped++;
                            }
                        } else if (props.isReconcileByCpfWhenIdMissing() && cpf != null) {
                            List<Long> byCpfDry =
                                    jdbcTemplate.query(
                                            "SELECT id FROM " + tblPessoa + " WHERE cpf = ? LIMIT 2",
                                            (rs, rowNum) -> rs.getLong(1),
                                            cpf);
                            if (byCpfDry.size() == 1) {
                                stats.wouldUpdate++;
                            } else {
                                stats.wouldInsert++;
                            }
                        } else {
                            stats.wouldInsert++;
                        }
                        log.debug("DRY-RUN row {} id {}", excelRow, pessoaId);
                        continue;
                    }

                    Long existsCount =
                            jdbcTemplate.queryForObject(
                                    "SELECT COUNT(*) FROM " + tblPessoa + " WHERE id = ?", Long.class, pessoaId);
                    boolean idExiste = existsCount != null && existsCount > 0;
                    Timestamp now = Timestamp.from(Instant.now());

                    if (idExiste) {
                        if (props.isUpdateExisting()) {
                            try {
                                persistPessoaActualizacao(
                                        pessoaId,
                                        nome,
                                        cpf,
                                        email,
                                        telPessoaCol,
                                        dataNasc,
                                        rg,
                                        orgaoRg,
                                        profissao,
                                        nacionalidade,
                                        estadoCivil,
                                        genero,
                                        rua,
                                        bairro,
                                        uf,
                                        cidade,
                                        cep,
                                        slots,
                                        now);
                                writeLine(rep, excelRow, String.valueOf(pessoaId), "UPDATE", "OK");
                                stats.updated++;
                            } catch (IllegalStateException ex) {
                                writeLine(rep, excelRow, String.valueOf(pessoaId), "SKIP", truncateMsg(ex.getMessage()));
                                stats.skipped++;
                            } catch (DataAccessException ex) {
                                log.warn("Falha na linha Excel {} pessoa id {}: {}", excelRow, pessoaId, ex.getMessage());
                                writeLine(rep, excelRow, String.valueOf(pessoaId), "ERROR", truncateMsg(ex.getMessage()));
                                stats.skipped++;
                            }
                        } else {
                            writeLine(rep, excelRow, String.valueOf(pessoaId), "SKIP", "ID já existe no banco");
                            stats.skipped++;
                        }
                        continue;
                    }

                    if (props.isReconcileByCpfWhenIdMissing() && cpf != null) {
                        List<Long> byCpf =
                                jdbcTemplate.query(
                                        "SELECT id FROM " + tblPessoa + " WHERE cpf = ? LIMIT 2",
                                        (rs, rowNum) -> rs.getLong(1),
                                        cpf);
                        if (byCpf.size() == 1) {
                            long rid = byCpf.get(0);
                            try {
                                persistPessoaActualizacao(
                                        rid,
                                        nome,
                                        cpf,
                                        email,
                                        telPessoaCol,
                                        dataNasc,
                                        rg,
                                        orgaoRg,
                                        profissao,
                                        nacionalidade,
                                        estadoCivil,
                                        genero,
                                        rua,
                                        bairro,
                                        uf,
                                        cidade,
                                        cep,
                                        slots,
                                        now);
                                writeLine(
                                        rep,
                                        excelRow,
                                        String.valueOf(pessoaId),
                                        "RECONCILE_BY_CPF",
                                        "OK — actualizado id BD " + rid);
                                stats.reconciled++;
                            } catch (IllegalStateException ex) {
                                writeLine(rep, excelRow, String.valueOf(pessoaId), "SKIP", truncateMsg(ex.getMessage()));
                                stats.skipped++;
                            } catch (DataAccessException ex) {
                                log.warn("Falha na linha Excel {} pessoa planilha id {}: {}", excelRow, pessoaId, ex.getMessage());
                                writeLine(rep, excelRow, String.valueOf(pessoaId), "ERROR", truncateMsg(ex.getMessage()));
                                stats.skipped++;
                            }
                            continue;
                        }
                    }

                    if (cpf != null) {
                        Long cpfClash =
                                jdbcTemplate.queryForObject(
                                        "SELECT COUNT(*) FROM " + tblPessoa + " WHERE cpf = ?", Long.class, cpf);
                        if (cpfClash != null && cpfClash > 0) {
                            writeLine(rep, excelRow, String.valueOf(pessoaId), "SKIP", "CPF já existe no banco (outro id)");
                            stats.skipped++;
                            continue;
                        }
                    }

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

                        writeLine(rep, excelRow, String.valueOf(pessoaId), "INSERT", "OK");
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
                "Importação pessoas concluída: inseridas={}, actualizadas={}, reconciliadas_por_cpf={}, candidatas_dry_run_insert={}, candidatas_dry_run_update={}, ignoradas={}, emails_anulados_planilha={}, dryRun={}",
                stats.inserted,
                stats.updated,
                stats.reconciled,
                stats.wouldInsert,
                stats.wouldUpdate,
                stats.skipped,
                stats.emailNulled,
                props.isDryRun());

        return stats;
    }

    private void persistPessoaActualizacao(
            long targetPessoaId,
            String nome,
            String cpf,
            String email,
            String telPessoaCol,
            LocalDate dataNasc,
            String rg,
            String orgaoRg,
            String profissao,
            String nacionalidade,
            String estadoCivil,
            String genero,
            String rua,
            String bairro,
            String uf,
            String cidade,
            String cep,
            List<TelefoneSlot> slots,
            Timestamp now) {
        if (cpf != null) {
            Long clash =
                    jdbcTemplate.queryForObject(
                            "SELECT COUNT(*) FROM " + tblPessoa + " WHERE cpf = ? AND id <> ?",
                            Long.class,
                            cpf,
                            targetPessoaId);
            if (clash != null && clash > 0) {
                throw new IllegalStateException("CPF já existe no banco (outro id)");
            }
        }
        jdbcTemplate.update(
                "UPDATE "
                        + tblPessoa
                        + " SET nome = ?, cpf = ?, email = ?, telefone = ?, data_nascimento = ?, updated_at = ? WHERE id = ?",
                nome,
                cpf,
                email.isBlank() ? null : email,
                telPessoaCol.isBlank() ? null : telPessoaCol,
                dataNasc,
                now,
                targetPessoaId);

        jdbcTemplate.update(
                "INSERT INTO "
                        + tblComplementar
                        + """
                         (pessoa_id, rg, orgao_expedidor, profissao, nacionalidade, estado_civil, genero)
                        VALUES (?,?,?,?,?,?,?)
                        ON DUPLICATE KEY UPDATE rg = VALUES(rg), orgao_expedidor = VALUES(orgao_expedidor),
                        profissao = VALUES(profissao), nacionalidade = VALUES(nacionalidade), estado_civil = VALUES(estado_civil), genero = VALUES(genero)
                        """,
                targetPessoaId,
                rg.isBlank() ? null : rg,
                orgaoRg.isBlank() ? null : orgaoRg,
                profissao.isBlank() ? null : profissao,
                nacionalidade.isBlank() ? null : nacionalidade,
                estadoCivil.isBlank() ? null : estadoCivil,
                genero.isBlank() ? null : genero);

        jdbcTemplate.update(
                "DELETE FROM " + tblEndereco + " WHERE pessoa_id = ? AND numero_ordem = ?", targetPessoaId, 1);
        if (!rua.isBlank()) {
            jdbcTemplate.update(
                    "INSERT INTO "
                            + tblEndereco
                            + """
                             (pessoa_id, numero_ordem, rua, bairro, estado, cidade, cep, auto_preenchido)
                            VALUES (?,?,?,?,?,?,?,FALSE)
                            """,
                    targetPessoaId,
                    1,
                    rua,
                    bairro.isBlank() ? null : bairro,
                    uf.isBlank() ? null : uf,
                    cidade.isBlank() ? null : cidade,
                    cep.isBlank() ? null : cep);
        }

        jdbcTemplate.update(
                "DELETE FROM " + tblContato + " WHERE pessoa_id = ? AND usuario_lancamento = ?",
                targetPessoaId,
                USUARIO_IMPORT);
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
                    targetPessoaId,
                    "telefone",
                    valor,
                    now,
                    now,
                    USUARIO_IMPORT);
        }
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
            String tel = CadastroPessoasPlanilhaImportSupport.corrigirMojibakePlanilhaUtf8(stringCell(row, p[0], fmt))
                    .trim();
            String inf = CadastroPessoasPlanilhaImportSupport.corrigirMojibakePlanilhaUtf8(stringCell(row, p[1], fmt))
                    .trim();
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

    /**
     * Evita percorrer até {@link Sheet#getLastRowNum()} quando o .xls reserva milhares de linhas vazias.
     * Considera a última linha com ID na coluna A ou nome na coluna B.
     */
    static int lastDataRowIndex(Sheet sh, int dataStart0, DataFormatter fmt) {
        int poiLast = sh.getLastRowNum();
        for (int r = poiLast; r >= dataStart0; r--) {
            Row row = sh.getRow(r);
            if (row == null) {
                continue;
            }
            if (readLongIdStatic(row, 0).isPresent()) {
                return r;
            }
            String nome = stringCellStatic(row, 1, fmt);
            if (nome != null && !nome.isBlank()) {
                return r;
            }
        }
        return Math.max(dataStart0 - 1, 0);
    }

    private static Optional<Long> readLongIdStatic(Row row, int col) {
        if (row == null) {
            return Optional.empty();
        }
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

    private static String stringCellStatic(Row row, int colIndex, DataFormatter fmt) {
        Cell c = row.getCell(colIndex);
        if (c == null) {
            return "";
        }
        try {
            return switch (c.getCellType()) {
                case STRING -> nullToEmpty(c.getStringCellValue());
                case NUMERIC -> {
                    double v = c.getNumericCellValue();
                    if (v == Math.rint(v) && v >= Long.MIN_VALUE && v <= Long.MAX_VALUE) {
                        yield String.valueOf((long) v);
                    }
                    yield String.valueOf(v);
                }
                default -> fmt.formatCellValue(c);
            };
        } catch (Exception e) {
            return "";
        }
    }

    private Optional<Long> readLongId(Row row, int col) {
        return readLongIdStatic(row, col);
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
        /** Linhas actualizadas por id existente (update-existing). */
        public int updated;
        /** Linhas actualizadas por CNPJ/CPF quando o id da planilha não existia. */
        public int reconciled;
        /** Linhas que seriam gravadas em dry-run (INSERT). */
        public int wouldInsert;
        /** Linhas que seriam actualizadas em dry-run (UPDATE ou reconciliação por CPF). */
        public int wouldUpdate;
        public int skipped;
        public int emailNulled;
    }
}
