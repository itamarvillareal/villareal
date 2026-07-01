package br.com.vilareal.condominio.planilha;

import br.com.vilareal.condominio.api.dto.PlanilhaEnderecoDto;
import br.com.vilareal.condominio.api.dto.PlanilhaPessoaDto;
import br.com.vilareal.condominio.api.dto.UnidadePlanilhaLinhaDto;
import br.com.vilareal.pessoa.importacao.CadastroPessoasPlanilhaImportSupport;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;

import java.io.IOException;
import java.io.InputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Planilha Condo Id «Condôminos por unidade»: linha {@code QD01-LT01} seguida de uma ou mais linhas de pessoa.
 * Colunas: Nome (A), Tipo (B), CPF/CNPJ (D/E), RG (F/G), E-mail (H/I), Contato (J/K), Endereço (L/M).
 */
public final class CondoIdUnidadesProprietariosXlsReader {

    private static final Pattern PAT_UNIDADE = Pattern.compile("^QD\\d+-LT\\d+$", Pattern.CASE_INSENSITIVE);

    private static final int COL_NOME = 0;
    private static final int COL_CPF_PRIMARIO = 3;
    private static final int COL_CPF_SECUNDARIO = 4;
    private static final int COL_RG_PRIMARIO = 5;
    private static final int COL_RG_SECUNDARIO = 6;
    private static final int COL_EMAIL_PRIMARIO = 7;
    private static final int COL_EMAIL_SECUNDARIO = 8;
    private static final int COL_CONTATO_PRIMARIO = 9;
    private static final int COL_CONTATO_SECUNDARIO = 10;
    private static final int COL_ENDERECO_PRIMARIO = 11;
    private static final int COL_ENDERECO_SECUNDARIO = 12;

    private CondoIdUnidadesProprietariosXlsReader() {}

    public record LeituraResult(List<UnidadePlanilhaLinhaDto> linhas, int unidadesComCoproprietariosAdicionais) {}

    public static boolean isFormato(Sheet sh, DataFormatter fmt) {
        if (sh == null) {
            return false;
        }
        int last = Math.min(sh.getLastRowNum(), 40);
        for (int r = 0; r <= last; r++) {
            Row row = sh.getRow(r);
            if (row == null) {
                continue;
            }
            String colA = stringCell(row, COL_NOME, fmt);
            if (isCodigoUnidade(colA)) {
                return true;
            }
            String header = normalizarHeader(stringCell(row, COL_CPF_SECUNDARIO, fmt));
            if ("NOME".equals(normalizarHeader(colA)) && header.contains("CPF")) {
                return true;
            }
        }
        return false;
    }

    public static LeituraResult lerLinhas(InputStream in) throws IOException {
        DataFormatter fmt = new DataFormatter(Locale.forLanguageTag("pt-BR"));
        try (Workbook wb = WorkbookFactory.create(in)) {
            Sheet sh = wb.getNumberOfSheets() > 0 ? wb.getSheetAt(0) : null;
            if (sh == null) {
                throw new IOException("Planilha sem abas.");
            }
            return lerSheet(sh, fmt);
        }
    }

    static LeituraResult lerSheet(Sheet sh, DataFormatter fmt) {
        List<UnidadePlanilhaLinhaDto> out = new ArrayList<>();
        int coprop = 0;
        String unidadeAtual = null;
        List<LinhaPessoaBruta> pessoasUnidade = new ArrayList<>();

        int last = sh.getLastRowNum();
        for (int r = 0; r <= last; r++) {
            Row row = sh.getRow(r);
            if (row == null) {
                continue;
            }
            String colA = stringCell(row, COL_NOME, fmt);
            if (colA.isEmpty()) {
                continue;
            }
            if (isLinhaCabecalho(colA, row, fmt)) {
                continue;
            }
            if (isCodigoUnidade(colA)) {
                if (unidadeAtual != null) {
                    Optional<UnidadePlanilhaLinhaDto> dto = montarUnidade(unidadeAtual, pessoasUnidade);
                    dto.ifPresent(out::add);
                    if (pessoasUnidade.size() > 1) {
                        coprop++;
                    }
                }
                unidadeAtual = UnidadesProprietariosPlanilhaSupport.normalizarCodigoUnidade(colA);
                pessoasUnidade = new ArrayList<>();
                continue;
            }
            if (unidadeAtual == null) {
                continue;
            }
            LinhaPessoaBruta pessoa = lerLinhaPessoa(row, fmt);
            if (pessoa.temConteudo()) {
                pessoasUnidade.add(pessoa);
            }
        }
        if (unidadeAtual != null) {
            Optional<UnidadePlanilhaLinhaDto> dto = montarUnidade(unidadeAtual, pessoasUnidade);
            dto.ifPresent(out::add);
            if (pessoasUnidade.size() > 1) {
                coprop++;
            }
        }
        return new LeituraResult(out, coprop);
    }

    private static boolean isLinhaCabecalho(String colA, Row row, DataFormatter fmt) {
        if ("NOME".equals(normalizarHeader(colA))) {
            return true;
        }
        String cpfHeader = normalizarHeader(stringCell(row, COL_CPF_SECUNDARIO, fmt));
        return cpfHeader.contains("CPF") && cpfHeader.contains("CNPJ");
    }

    private static Optional<UnidadePlanilhaLinhaDto> montarUnidade(String codUnidade, List<LinhaPessoaBruta> pessoas) {
        if (pessoas.isEmpty()) {
            return Optional.empty();
        }
        LinhaPessoaBruta principal = pessoas.getFirst();
        for (LinhaPessoaBruta p : pessoas) {
            if (p.cpfNormalizado.isPresent()) {
                principal = p;
                break;
            }
        }
        PlanilhaEnderecoDto endereco =
                UnidadesProprietariosPlanilhaSupport.montarEndereco("", "", "", "", "", "");
        for (int i = pessoas.size() - 1; i >= 0; i--) {
            if (pessoas.get(i).enderecoBruto != null && !pessoas.get(i).enderecoBruto.isBlank()) {
                endereco = UnidadesProprietariosPlanilhaSupport.parseEnderecoTextoLivre(pessoas.get(i).enderecoBruto);
                break;
            }
        }
        PlanilhaPessoaDto proprietario = principal.toPlanilhaPessoa();
        PlanilhaPessoaDto inquilino = new PlanilhaPessoaDto("", "", "", "", List.of(), List.of());
        return Optional.of(new UnidadePlanilhaLinhaDto(
                codUnidade, proprietario, inquilino, endereco, "PENDENTE", "PENDENTE"));
    }

    private static LinhaPessoaBruta lerLinhaPessoa(Row row, DataFormatter fmt) {
        String nome =
                CadastroPessoasPlanilhaImportSupport.normalizeNomeCadastro(stringCell(row, COL_NOME, fmt));
        String cpfRaw = primeiroNaoVazio(
                stringCell(row, COL_CPF_PRIMARIO, fmt), stringCell(row, COL_CPF_SECUNDARIO, fmt));
        Optional<String> cpfNorm = CadastroPessoasPlanilhaImportSupport.normalizeCpfCnpj(cpfRaw);
        String rg = CadastroPessoasPlanilhaImportSupport.truncate(
                primeiroNaoVazio(
                        stringCell(row, COL_RG_PRIMARIO, fmt), stringCell(row, COL_RG_SECUNDARIO, fmt)),
                40);
        String emailBruto = primeiroNaoVazio(
                stringCell(row, COL_EMAIL_PRIMARIO, fmt), stringCell(row, COL_EMAIL_SECUNDARIO, fmt));
        List<String> emails = UnidadesProprietariosPlanilhaSupport.splitEmailsOuVazio(emailBruto);
        String contatoBruto = primeiroNaoVazio(
                stringCell(row, COL_CONTATO_PRIMARIO, fmt), stringCell(row, COL_CONTATO_SECUNDARIO, fmt));
        List<String> telefones = UnidadesProprietariosPlanilhaSupport.splitTelefonesEspacoOuSeparador(contatoBruto);
        String enderecoBruto = primeiroNaoVazio(
                stringCell(row, COL_ENDERECO_PRIMARIO, fmt), stringCell(row, COL_ENDERECO_SECUNDARIO, fmt));
        return new LinhaPessoaBruta(nome, cpfRaw, cpfNorm, rg, emails, telefones, enderecoBruto);
    }

    private static boolean isCodigoUnidade(String colA) {
        if (colA == null || colA.isBlank()) {
            return false;
        }
        return PAT_UNIDADE.matcher(colA.trim().replaceAll("\\s+", "")).matches();
    }

    private static String normalizarHeader(String s) {
        if (s == null) {
            return "";
        }
        return Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toUpperCase(Locale.ROOT)
                .trim();
    }

    private static String primeiroNaoVazio(String... vals) {
        for (String v : vals) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return "";
    }

    private static String stringCell(Row row, int col, DataFormatter fmt) {
        if (row == null) {
            return "";
        }
        Cell cell = row.getCell(col);
        if (cell == null) {
            return "";
        }
        return fmt.formatCellValue(cell).trim();
    }

    private static final class LinhaPessoaBruta {
        final String nome;
        final String cpfRaw;
        final Optional<String> cpfNormalizado;
        final String rg;
        final List<String> emails;
        final List<String> telefones;
        final String enderecoBruto;

        LinhaPessoaBruta(
                String nome,
                String cpfRaw,
                Optional<String> cpfNormalizado,
                String rg,
                List<String> emails,
                List<String> telefones,
                String enderecoBruto) {
            this.nome = nome;
            this.cpfRaw = cpfRaw;
            this.cpfNormalizado = cpfNormalizado;
            this.rg = rg;
            this.emails = emails;
            this.telefones = telefones;
            this.enderecoBruto = enderecoBruto;
        }

        boolean temConteudo() {
            return (nome != null && !nome.isBlank()) || cpfNormalizado.isPresent();
        }

        PlanilhaPessoaDto toPlanilhaPessoa() {
            return new PlanilhaPessoaDto(
                    nome != null ? nome : "",
                    cpfRaw != null ? cpfRaw : "",
                    cpfNormalizado.orElse(""),
                    rg != null ? rg : "",
                    emails != null ? emails : List.of(),
                    telefones != null ? telefones : List.of());
        }
    }
}
