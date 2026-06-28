package br.com.vilareal.projudi;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Separa o campo {@code pessoa_endereco.rua} (logradouro + nº + complemento concatenados)
 * em campos compatíveis com o cadastro de partes do PROJUDI.
 */
public final class ProjudiEnderecoParser {

    private static final Pattern NUMERO_MARCADOR =
            Pattern.compile("(?i)^(?:n[º°o]\\.?\\s*|numero\\s*:?\\s*|n\\.\\s*)(.+)$");

    private ProjudiEnderecoParser() {}

    public record EnderecoPartes(String logradouro, String numero, String complemento) {}

    public record ResultadoParse(EnderecoPartes partes, boolean baixaConfianca) {}

    public static ResultadoParse parse(String ruaConcatenada) {
        String t = ruaConcatenada == null ? "" : ruaConcatenada.trim();
        if (t.isEmpty()) {
            return new ResultadoParse(new EnderecoPartes("", "SN", ""), true);
        }

        String[] segmentos = t.split("\\s*,\\s*");
        if (segmentos.length == 1) {
            String unico = segmentos[0].trim();
            if (isSemNumero(unico)) {
                return new ResultadoParse(new EnderecoPartes("", "SN", ""), true);
            }
            ExtracaoInline inline = extrairNumeroInline(unico);
            if (inline != null) {
                return new ResultadoParse(
                        new EnderecoPartes(inline.logradouro(), inline.numero(), ""),
                        inline.baixaConfianca());
            }
            return new ResultadoParse(new EnderecoPartes(unico, "SN", ""), false);
        }

        int idxNumero = -1;
        String numero = "SN";
        String prefixoNoSegmento = null;
        boolean ambiguo = false;

        for (int i = 0; i < segmentos.length; i++) {
            String seg = segmentos[i].trim();
            if (seg.isEmpty()) {
                continue;
            }
            if (isSemNumero(seg)) {
                idxNumero = i;
                numero = "SN";
                break;
            }
            Matcher marcador = NUMERO_MARCADOR.matcher(seg);
            if (marcador.matches()) {
                idxNumero = i;
                numero = normalizarNumero(marcador.group(1));
                break;
            }
            ExtracaoInline inline = extrairNumeroInline(seg);
            if (inline != null) {
                idxNumero = i;
                numero = inline.numero();
                prefixoNoSegmento = inline.logradouro();
                ambiguo = inline.baixaConfianca();
                break;
            }
        }

        if (idxNumero < 0) {
            String logradouro = segmentos[0].trim();
            List<String> resto = new ArrayList<>();
            for (int i = 1; i < segmentos.length; i++) {
                if (!segmentos[i].trim().isEmpty()) {
                    resto.add(segmentos[i].trim());
                }
            }
            return new ResultadoParse(
                    new EnderecoPartes(logradouro, "SN", String.join(", ", resto)), false);
        }

        List<String> logradouroPartes = new ArrayList<>();
        for (int i = 0; i < idxNumero; i++) {
            if (!segmentos[i].trim().isEmpty()) {
                logradouroPartes.add(segmentos[i].trim());
            }
        }
        if (prefixoNoSegmento != null && !prefixoNoSegmento.isBlank()) {
            logradouroPartes.add(prefixoNoSegmento);
        }

        List<String> complementoPartes = new ArrayList<>();
        for (int i = idxNumero + 1; i < segmentos.length; i++) {
            if (!segmentos[i].trim().isEmpty()) {
                complementoPartes.add(segmentos[i].trim());
            }
        }

        String logradouro = String.join(", ", logradouroPartes).trim();
        if (logradouro.isEmpty() && prefixoNoSegmento == null && !isSemNumero(segmentos[idxNumero])) {
            Matcher marcador = NUMERO_MARCADOR.matcher(segmentos[idxNumero].trim());
            ambiguo = true;
        }

        return new ResultadoParse(
                new EnderecoPartes(logradouro, numero, String.join(", ", complementoPartes)), ambiguo);
    }

    private static boolean isSemNumero(String texto) {
        if (texto == null || texto.isBlank()) {
            return false;
        }
        String n = texto.trim().replaceAll("\\s+", " ");
        return n.equalsIgnoreCase("S/N")
                || n.equalsIgnoreCase("SN")
                || n.equalsIgnoreCase("S N")
                || n.equalsIgnoreCase("SEM NUMERO")
                || n.equalsIgnoreCase("SEM NÚMERO")
                || n.equalsIgnoreCase("SEM NUMERO.");
    }

    private static String normalizarNumero(String bruto) {
        if (bruto == null || bruto.isBlank()) {
            return "SN";
        }
        String n = bruto.trim();
        if (isSemNumero(n)) {
            return "SN";
        }
        return n;
    }

    private record ExtracaoInline(String logradouro, String numero, boolean baixaConfianca) {}

    /**
     * Detecta padrão "LOGRADOURO nº 123" dentro de um único segmento (sem vírgula antes do número).
     */
    private static ExtracaoInline extrairNumeroInline(String segmento) {
        Pattern inline = Pattern.compile("(?i)^(.+?)\\s+(?:n[º°o]\\.?\\s*|numero\\s*:?\\s*|n\\.\\s*)(.+)$");
        Matcher m = inline.matcher(segmento.trim());
        if (!m.matches()) {
            return null;
        }
        String log = m.group(1).trim();
        String num = normalizarNumero(m.group(2).trim());
        return new ExtracaoInline(log, num, false);
    }
}
