package br.com.vilareal.documento.parse;

import br.com.vilareal.documento.DocumentoPdfService;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/** Resolve «local e data» no modo reformatar (formulário × documento importado). */
public final class DocumentoLocalDataResolver {

    private DocumentoLocalDataResolver() {}

    /**
     * Prioridade: formulário com data completa → montar a partir de cidade + data ISO →
     * documento (se dia não for placeholder) → padrão do escritório.
     */
    public static String resolver(String cidadeEstadoForm, String dataIso, String localDataDocumento, DocumentoPdfService pdfService) {
        if (StringUtils.hasText(cidadeEstadoForm)) {
            String form = cidadeEstadoForm.trim();
            if (DocumentoParseadoHeuristics.ehLocalData(form) && !DocumentoParseadoHeuristics.temPlaceholderDia(form)) {
                return DocumentoPdfService.normalizarCidadeEstadoLocal(
                        DocumentoParseadoHeuristics.normalizarLocalDataFinal(form));
            }
            return pdfService.montarLocalData(form, parseData(dataIso));
        }
        if (StringUtils.hasText(localDataDocumento) && !DocumentoParseadoHeuristics.temPlaceholderDia(localDataDocumento)) {
            return DocumentoPdfService.normalizarCidadeEstadoLocal(
                    DocumentoParseadoHeuristics.normalizarLocalDataFinal(localDataDocumento.trim()));
        }
        return pdfService.montarLocalData("Anápolis, estado de Goiás", parseData(dataIso));
    }

    public static boolean ehLinhaLocalDataParaRemover(String texto) {
        return DocumentoParseadoHeuristics.ehLocalData(texto) || DocumentoParseadoHeuristics.temPlaceholderDia(texto);
    }

    private static LocalDate parseData(String dataIso) {
        if (!StringUtils.hasText(dataIso)) {
            return LocalDate.now();
        }
        try {
            return LocalDate.parse(dataIso.trim());
        } catch (DateTimeParseException e) {
            return LocalDate.now();
        }
    }
}
