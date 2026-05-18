package br.com.vilareal.processo.domain;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

import org.springframework.util.StringUtils;

/**
 * Títulos gerados automaticamente pelo sistema legado (VB) ao gravar histórico na pasta.
 * O relatório «Consultas Realizadas» do legado não os inclui na listagem do dia.
 */
public final class HistoricoTituloLegadoSistema {

    private static final Pattern JUNTAR_PETICAO_PASTA =
            Pattern.compile("^JUNTAR PETI.{0,4} INSERIDA NA PASTA EM\\b");
    private static final Pattern PETICAO_ANTERIOR_JUNTADA =
            Pattern.compile("^PETI.{0,4} DA INF.{0,16} ANTERIOR JUNTADA EM\\b");

    private HistoricoTituloLegadoSistema() {}

    public static boolean ehTituloSistemaLegado(String titulo) {
        if (!StringUtils.hasText(titulo)) {
            return false;
        }
        String t = normalizar(titulo);
        if (t.isEmpty()) {
            return false;
        }
        return JUNTAR_PETICAO_PASTA.matcher(t).find() || PETICAO_ANTERIOR_JUNTADA.matcher(t).find();
    }

    private static String normalizar(String titulo) {
        String t = Normalizer.normalize(titulo.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toUpperCase(Locale.ROOT)
                .replaceAll("\\s+", " ");
        return t.trim();
    }
}
