package br.com.vilareal.documento;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Destaque tipográfico de nomes no contrato de locação. */
final class ContratoLocacaoNegritoUtil {

    private ContratoLocacaoNegritoUtil() {}

    static String aplicarNegritoNomesCompletos(String html, String... nomes) {
        if (!StringUtils.hasText(html) || nomes == null) {
            return html != null ? html : "";
        }
        List<String> variantes = new ArrayList<>();
        for (String nome : nomes) {
            if (!StringUtils.hasText(nome)) {
                continue;
            }
            String base = Utf8MojibakeUtil.corrigir(nome.trim());
            variantes.add(base);
            variantes.add(base.toUpperCase(Locale.ROOT));
            variantes.add(properCasePalavras(base));
        }
        variantes.sort(Comparator.comparingInt(String::length)
                .reversed()
                .thenComparing(v -> v.equals(v.toUpperCase(Locale.ROOT)) ? 0 : 1));

        String result = html;
        Set<String> vistos = new LinkedHashSet<>();
        for (String variante : variantes) {
            if (!StringUtils.hasText(variante) || !vistos.add(variante.trim())) {
                continue;
            }
            result = envolverComStrong(result, ContratoLocacaoDocumentoService.escapeHtml(variante));
        }
        return result;
    }

    private static String envolverComStrong(String html, String trechoEscapado) {
        if (!StringUtils.hasText(trechoEscapado) || !html.contains(trechoEscapado)) {
            return html;
        }
        String marcador = "<strong>" + trechoEscapado + "</strong>";
        if (html.contains(marcador)) {
            return html;
        }
        return html.replace(trechoEscapado, marcador);
    }

    private static String properCasePalavras(String texto) {
        if (!StringUtils.hasText(texto)) {
            return texto != null ? texto : "";
        }
        String[] partes = texto.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < partes.length; i++) {
            String p = partes[i];
            if (!p.isEmpty()) {
                sb.append(Character.toUpperCase(p.charAt(0)));
                if (p.length() > 1) {
                    sb.append(p.substring(1).toLowerCase(Locale.ROOT));
                }
            }
            if (i < partes.length - 1) {
                sb.append(' ');
            }
        }
        return sb.toString();
    }
}
