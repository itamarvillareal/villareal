package br.com.vilareal.documento;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.util.StringUtils;

/**
 * Insere hífens opcionais (U+00AD) nos limites silábicos do português para o OpenHTMLToPDF:
 * na quebra de linha o motor exibe o hífen visível apenas no ponto silábico correto.
 */
public final class PortuguesHifenizacaoUtil {

    static final char HIFEN_OPCIONAL = '\u00AD';

    private static final Pattern TOKEN_PALAVRA =
            Pattern.compile("[\\p{L}]+(?:[''][\\p{L}]+)*|[\\p{L}]+");

    private static final Pattern ANTES_NUCLEO_NASAL =
            Pattern.compile("(?iu)([\\p{L}]{2,})(ão|ões|ães|am|em|im|om|um|êm|íam)(?=\\P{L}|$)");

    private static final Set<String> DIGRAFOS_INSEPARAVEIS = Set.of(
            "br", "bl", "cr", "cl", "dr", "fr", "fl", "gr", "gl", "pr", "pl", "tr", "tl", "vr", "vl",
            "ch", "lh", "nh", "rr", "ss", "sc", "sç", "xc", "qu", "gu");

    private static final Set<Character> VOGais = Set.of(
            'a', 'á', 'à', 'â', 'ã',
            'e', 'é', 'ê',
            'i', 'í',
            'o', 'ó', 'ô', 'õ',
            'u', 'ú');

    private PortuguesHifenizacaoUtil() {}

    /** Formata nome para PDF: hifenização silábica em cada token e NBSP entre palavras. */
    public static String formatarNomeParaPdf(String nome) {
        if (!StringUtils.hasText(nome)) {
            return "";
        }
        String[] partes = nome.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < partes.length; i++) {
            if (i > 0) {
                sb.append('\u00A0');
            }
            sb.append(inserirHifensSilabicos(partes[i]));
        }
        return sb.toString();
    }

    /** Insere U+00AD nos limites silábicos de uma palavra (preserva maiúsculas/acentos). */
    public static String inserirHifensSilabicos(String palavra) {
        if (!StringUtils.hasText(palavra) || palavra.length() < 4) {
            return palavra == null ? "" : palavra;
        }
        if (!palavra.chars().allMatch(c -> c == HIFEN_OPCIONAL || Character.isLetter(c))) {
            return palavra;
        }
        String limpa = palavra.replace(String.valueOf(HIFEN_OPCIONAL), "");
        List<Integer> limites = calcularLimitesSilabicos(limpa);
        if (limites.isEmpty()) {
            return limpa;
        }
        StringBuilder sb = new StringBuilder(limpa.length() + limites.size());
        for (int i = 0; i < limpa.length(); i++) {
            if (limites.contains(i)) {
                sb.append(HIFEN_OPCIONAL);
            }
            sb.append(limpa.charAt(i));
        }
        return sb.toString();
    }

    /** Hifeniza texto plano fora de tags HTML (preserva espaços e pontuação). */
    public static String inserirHifensSilabicosNoTexto(String texto) {
        if (!StringUtils.hasText(texto)) {
            return texto;
        }
        Matcher m = TOKEN_PALAVRA.matcher(texto);
        StringBuilder out = new StringBuilder(texto.length() + 16);
        int last = 0;
        while (m.find()) {
            out.append(texto, last, m.start());
            out.append(inserirHifensSilabicos(m.group()));
            last = m.end();
        }
        out.append(texto.substring(last));
        return out.toString();
    }

    /**
     * Percorre segmentos de texto fora de tags HTML e aplica hifenização silábica.
     * Ignora blocos {@code data-unica}, {@code valor-monetario-num} e {@code nowrap}.
     */
    public static String inserirHifensSilabicosNoHtml(String html) {
        if (!StringUtils.hasText(html)) {
            return html;
        }
        StringBuilder out = new StringBuilder(html.length() + 32);
        int i = 0;
        int skipDepth = 0;
        while (i < html.length()) {
            int tagStart = html.indexOf('<', i);
            if (tagStart < 0) {
                if (skipDepth == 0) {
                    out.append(inserirHifensSilabicosNoTexto(html.substring(i)));
                } else {
                    out.append(html.substring(i));
                }
                break;
            }
            if (tagStart > i) {
                if (skipDepth == 0) {
                    out.append(inserirHifensSilabicosNoTexto(html.substring(i, tagStart)));
                } else {
                    out.append(html.substring(i, tagStart));
                }
            }
            int tagEnd = html.indexOf('>', tagStart);
            if (tagEnd < 0) {
                out.append(html.substring(tagStart));
                break;
            }
            String tag = html.substring(tagStart, tagEnd + 1);
            out.append(tag);
            i = tagEnd + 1;
            String fechamentoRaw = tagConteudoRaw(tag);
            if (fechamentoRaw != null) {
                int fim = html.toLowerCase(Locale.ROOT).indexOf(fechamentoRaw, i);
                if (fim < 0) {
                    out.append(html.substring(i));
                    break;
                }
                out.append(html, i, fim);
                i = fim;
                continue;
            }
            skipDepth += deltaSkipHifenizacao(tag, skipDepth);
        }
        return out.toString();
    }

    /** CSS/JS não são texto: hifenizar dentro de style/script corrompe {@code position: running()}. */
    private static String tagConteudoRaw(String tag) {
        String lower = tag.toLowerCase(Locale.ROOT);
        if (lower.startsWith("<style") && !lower.endsWith("/>")) {
            return "</style";
        }
        if (lower.startsWith("<script") && !lower.endsWith("/>")) {
            return "</script";
        }
        return null;
    }

    private static int deltaSkipHifenizacao(String tag, int depth) {
        if (depth > 0) {
            if (tag.startsWith("</")) {
                return -1;
            }
            return 0;
        }
        String lower = tag.toLowerCase(Locale.ROOT);
        if (lower.contains("class=\"data-unica")
                || lower.contains("class=\"valor-monetario-num")
                || lower.contains("class='data-unica")
                || lower.contains("class='valor-monetario-num")
                || lower.contains("white-space:nowrap")
                || lower.contains("white-space: nowrap")) {
            return tag.startsWith("</") ? 0 : 1;
        }
        return 0;
    }

    static List<Integer> calcularLimitesSilabicos(String palavra) {
        Set<Integer> limites = new LinkedHashSet<>();
        Matcher nasal = ANTES_NUCLEO_NASAL.matcher(palavra);
        if (nasal.find()) {
            limites.add(nasal.start(2));
        }
        limites.addAll(limitesPorVogaisConsoantes(palavra));
        return limites.stream().filter(p -> p > 0 && p < palavra.length()).sorted().toList();
    }

    private static List<Integer> limitesPorVogaisConsoantes(String palavra) {
        String lower = palavra.toLowerCase(Locale.ROOT);
        int n = lower.length();
        List<Integer> limites = new ArrayList<>();
        int i = 0;
        while (i < n) {
            if (!isVogal(lower.charAt(i))) {
                i++;
                continue;
            }
            int vogalFim = i;
            while (vogalFim + 1 < n && isVogal(lower.charAt(vogalFim + 1)) && isDiftongo(lower, vogalFim)) {
                vogalFim++;
            }
            int consoanteInicio = vogalFim + 1;
            if (consoanteInicio >= n) {
                break;
            }
            int consoanteFim = consoanteInicio;
            while (consoanteFim < n && !isVogal(lower.charAt(consoanteFim))) {
                consoanteFim++;
            }
            if (consoanteFim >= n) {
                break;
            }
            int qtdConsoantes = consoanteFim - consoanteInicio;
            if (qtdConsoantes == 1) {
                limites.add(consoanteInicio);
            } else if (qtdConsoantes == 2) {
                String par = lower.substring(consoanteInicio, consoanteFim);
                if (DIGRAFOS_INSEPARAVEIS.contains(par)) {
                    limites.add(consoanteInicio);
                } else {
                    limites.add(consoanteInicio + 1);
                }
            } else if (qtdConsoantes >= 3) {
                limites.add(consoanteFim - 1);
            }
            i = vogalFim + 1;
        }
        return limites;
    }

    private static boolean isVogal(char c) {
        return VOGais.contains(Character.toLowerCase(c));
    }

    /** Dígrafos vocálicos que não se separam na hifenização. */
    private static boolean isDiftongo(String lower, int i) {
        if (i + 1 >= lower.length()) {
            return false;
        }
        String par = lower.substring(i, i + 2);
        return switch (par) {
            case "ai", "au", "ão", "ea", "ei", "eu", "ia", "ie", "io", "iu", "oa", "oe", "oi", "ou", "ua", "ue", "ui", "uo" -> true;
            default -> false;
        };
    }
}
