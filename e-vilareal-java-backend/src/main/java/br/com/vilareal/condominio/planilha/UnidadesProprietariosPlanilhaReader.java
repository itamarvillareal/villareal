package br.com.vilareal.condominio.planilha;

import br.com.vilareal.condominio.api.dto.UnidadePlanilhaLinhaDto;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;

/** Detecta o layout da planilha de unidades/proprietários e delega ao reader adequado. */
public final class UnidadesProprietariosPlanilhaReader {

    public record LeituraResult(
            List<UnidadePlanilhaLinhaDto> linhas,
            int unidadesComCoproprietariosAdicionais,
            String formatoDetectado) {}

    private UnidadesProprietariosPlanilhaReader() {}

    public static LeituraResult ler(InputStream in) throws IOException {
        byte[] bytes = in.readAllBytes();
        DataFormatter fmt = new DataFormatter(Locale.forLanguageTag("pt-BR"));
        try (Workbook wb = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            Sheet sh = wb.getNumberOfSheets() > 0 ? wb.getSheetAt(0) : null;
            if (sh == null) {
                throw new IOException("Planilha sem abas.");
            }
            if (CondoIdUnidadesProprietariosXlsReader.isFormato(sh, fmt)) {
                CondoIdUnidadesProprietariosXlsReader.LeituraResult condo =
                        CondoIdUnidadesProprietariosXlsReader.lerSheet(sh, fmt);
                return new LeituraResult(
                        condo.linhas(), condo.unidadesComCoproprietariosAdicionais(), "CONDO_ID");
            }
        }
        List<UnidadePlanilhaLinhaDto> legado =
                UnidadesProprietariosXlsReader.lerLinhas(new ByteArrayInputStream(bytes));
        return new LeituraResult(legado, 0, "LEGADO");
    }
}
