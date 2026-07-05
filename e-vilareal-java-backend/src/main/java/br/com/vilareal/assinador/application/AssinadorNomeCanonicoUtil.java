package br.com.vilareal.assinador.application;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoArquivoEntity;

import java.nio.file.Path;
import java.util.Locale;

final class AssinadorNomeCanonicoUtil {

    private AssinadorNomeCanonicoUtil() {}

    static String nomePdf(ProjudiPeticaoArquivoEntity arquivo) {
        return Path.of(arquivo.getPdfRef()).getFileName().toString();
    }

    static String nomeP7sEsperado(ProjudiPeticaoArquivoEntity arquivo) {
        String pdf = nomePdf(arquivo).toLowerCase(Locale.ROOT);
        if (pdf.endsWith(".pdf")) {
            return pdf + ".p7s";
        }
        return pdf + ".p7s";
    }
}
