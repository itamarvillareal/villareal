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
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Lê planilha de unidades / proprietários / inquilinos. Cabeçalho na linha 3 (Excel), dados a partir da linha 4.
 * Colunas 0-based conforme layout acordado (A, C–E, F–H, J–O, Y, Z–AD).
 */
public final class UnidadesProprietariosXlsReader {

    /** Linha 3 do Excel (índice 2). */
    public static final int HEADER_ROW_INDEX = 2;
    /** Linha 4 do Excel (índice 3). */
    public static final int DATA_FIRST_ROW_INDEX = 3;

    private static final int COL_UNIDADE = 0;
    private static final int COL_PROP_NOME = 2;
    private static final int COL_PROP_CPF = 3;
    private static final int COL_PROP_RG = 4;
    private static final int COL_PROP_EMAIL = 5;
    private static final int COL_PROP_FONE1 = 6;
    private static final int COL_PROP_FONE2 = 7;
    private static final int COL_INQ_NOME = 9;
    private static final int COL_INQ_CPF = 10;
    private static final int COL_INQ_RG = 11;
    private static final int COL_INQ_EMAIL = 12;
    private static final int COL_INQ_FONE1 = 13;
    private static final int COL_INQ_FONE2 = 14;
    private static final int COL_CEP = 24;
    private static final int COL_LOGRADOURO = 25;
    private static final int COL_NUMERO = 26;
    private static final int COL_BAIRRO = 27;
    private static final int COL_COMPLEMENTO = 28;
    private static final int COL_CIDADE_UF = 29;

    private UnidadesProprietariosXlsReader() {}

    public static List<UnidadePlanilhaLinhaDto> lerLinhas(InputStream in) throws IOException {
        DataFormatter fmt = new DataFormatter(Locale.forLanguageTag("pt-BR"));
        try (Workbook wb = WorkbookFactory.create(in)) {
            Sheet sh = wb.getNumberOfSheets() > 0 ? wb.getSheetAt(0) : null;
            if (sh == null) {
                throw new IOException("Planilha sem abas.");
            }
            List<UnidadePlanilhaLinhaDto> out = new ArrayList<>();
            int last = sh.getLastRowNum();
            for (int r = DATA_FIRST_ROW_INDEX; r <= last; r++) {
                Row row = sh.getRow(r);
                if (row == null) {
                    continue;
                }
                String unidadeRaw = stringCell(row, COL_UNIDADE, fmt);
                String codUnidade = UnidadesProprietariosPlanilhaSupport.normalizarCodigoUnidade(unidadeRaw);
                if (codUnidade.isEmpty()) {
                    continue;
                }

                String nomeProp =
                        CadastroPessoasPlanilhaImportSupport.normalizeNomeCadastro(stringCell(row, COL_PROP_NOME, fmt));
                String cpfPropRaw = stringCell(row, COL_PROP_CPF, fmt);
                Optional<String> cpfPropOpt = CadastroPessoasPlanilhaImportSupport.normalizeCpfCnpj(cpfPropRaw);
                String rgProp = CadastroPessoasPlanilhaImportSupport.truncate(stringCell(row, COL_PROP_RG, fmt), 40);
                List<String> emailsProp = UnidadesProprietariosPlanilhaSupport.splitEmailsOuVazio(stringCell(row, COL_PROP_EMAIL, fmt));
                List<String> fonesProp = UnidadesProprietariosPlanilhaSupport.splitTelefonesOuVazio(
                        stringCell(row, COL_PROP_FONE1, fmt), stringCell(row, COL_PROP_FONE2, fmt));

                PlanilhaPessoaDto proprietario = new PlanilhaPessoaDto(
                        nomeProp,
                        cpfPropRaw,
                        cpfPropOpt.orElse(""),
                        rgProp,
                        emailsProp,
                        fonesProp);

                String nomeInq =
                        CadastroPessoasPlanilhaImportSupport.normalizeNomeCadastro(stringCell(row, COL_INQ_NOME, fmt));
                String cpfInqRaw = stringCell(row, COL_INQ_CPF, fmt);
                Optional<String> cpfInqOpt = CadastroPessoasPlanilhaImportSupport.normalizeCpfCnpj(cpfInqRaw);
                String rgInq = CadastroPessoasPlanilhaImportSupport.truncate(stringCell(row, COL_INQ_RG, fmt), 40);
                List<String> emailsInq = UnidadesProprietariosPlanilhaSupport.splitEmailsOuVazio(stringCell(row, COL_INQ_EMAIL, fmt));
                List<String> fonesInq = UnidadesProprietariosPlanilhaSupport.splitTelefonesOuVazio(
                        stringCell(row, COL_INQ_FONE1, fmt), stringCell(row, COL_INQ_FONE2, fmt));

                PlanilhaPessoaDto inquilino = new PlanilhaPessoaDto(
                        nomeInq,
                        cpfInqRaw,
                        cpfInqOpt.orElse(""),
                        rgInq,
                        emailsInq,
                        fonesInq);

                PlanilhaEnderecoDto endereco = UnidadesProprietariosPlanilhaSupport.montarEndereco(
                        stringCell(row, COL_CEP, fmt),
                        stringCell(row, COL_LOGRADOURO, fmt),
                        stringCell(row, COL_NUMERO, fmt),
                        stringCell(row, COL_BAIRRO, fmt),
                        stringCell(row, COL_COMPLEMENTO, fmt),
                        stringCell(row, COL_CIDADE_UF, fmt));

                out.add(new UnidadePlanilhaLinhaDto(
                        codUnidade, proprietario, inquilino, endereco, "PENDENTE", "PENDENTE"));
            }
            return out;
        }
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
}
