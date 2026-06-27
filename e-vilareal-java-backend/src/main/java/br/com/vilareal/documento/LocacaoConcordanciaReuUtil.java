package br.com.vilareal.documento;

import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Concordância verbal/adjetival com o polo Réu (locatário) nos modelos legados de locação.
 *
 * <p>Templates Access/VBA nem sempre envolvem verbos e adjetivos em {@code Adequa("@","Reu",…)}.
 * Este utilitário injeta essas marcações antes do processamento e corrige o texto já processado
 * em trechos que mencionam locatário(s), preservando zonas do locador/fiador.
 */
public final class LocacaoConcordanciaReuUtil {

    private static final Pattern ADEQUA_UMA_CAMADA = Pattern.compile(
            "(?:Ucase|Lcase|Propercase)?\\s*\\(\\s*Adequa\\(\"@\",\"(?:Autor|Reu|Fiador)\",\"[^\"]+\"\\)\\s*\\)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final Pattern ADEQUA_SIMPLES = Pattern.compile(
            "Adequa\\(\"@\",\"(?:Autor|Reu|Fiador)\",\"[^\"]+\"\\)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final Pattern ZONA_LOCADOR = Pattern.compile(
            "(?i)\\b(?:o\\s+|a\\s+)?locador(?:a|es|as)?\\b[^.§;]*",
            Pattern.UNICODE_CASE);

    private static final Pattern ZONA_FIADOR = Pattern.compile(
            "(?i)\\b(?:o\\s+|a\\s+|os\\s+|as\\s+)?fiador(?:a|es|as)?\\b[^.§;]*",
            Pattern.UNICODE_CASE);

    private static final Pattern TRECHO_LOCATARIO = Pattern.compile(
            "(?i)\\blocatári[oa]s?\\b[^.§;]*",
            Pattern.UNICODE_CASE);

    /** Lemas flexionados por {@link FlexaoUtil#adequar} no polo locatário (Réu). */
    private static final String[] LEMAS_REU = {
            "fica", "responsável", "obrigado", "deve", "deverá", "é", "está", "estar",
            "efetuar", "desfazer", "devedor", "inadimplente", "solvente", "pagador",
            "compelido", "condenado", "mencionado", "legítimo", "amparado", "requerido",
            "administrador", "encontra", "executado", "proprietário"
    };

    private LocacaoConcordanciaReuUtil() {}

    /**
     * Antes das substituições de {@code Adequa}: envolve palavras soltas que concordam com o locatário.
     */
    public static String injetarAdequaReuPalavrasSoltas(String template) {
        if (!StringUtils.hasText(template)) {
            return template != null ? template : "";
        }
        Reserva reservaAdequa = reservarAdequasExistentes(template);
        String texto = reservaAdequa.texto();
        Reserva reservaLocador = reservar(texto, ZONA_LOCADOR, "__ZONA_LOCADOR_");
        texto = reservaLocador.texto();
        Reserva reservaFiador = reservar(texto, ZONA_FIADOR, "__ZONA_FIADOR_");
        texto = reservaFiador.texto();

        for (String lema : LEMAS_REU) {
            texto = injetarLema(texto, lema);
        }

        texto = reservaFiador.restaurar(texto);
        texto = reservaLocador.restaurar(texto);
        return reservaAdequa.restaurar(texto);
    }

    /**
     * Após processamento: ajusta concordância em trechos com locatário(s) quando ainda há formas no singular.
     */
    public static String aplicarConcordanciaLocatarioProcessado(
            String texto, int quantidadeLocatarios, boolean feminino) {
        if (!StringUtils.hasText(texto) || quantidadeLocatarios < 1) {
            return texto != null ? texto : "";
        }
        FlexaoUtil.Genero genero =
                feminino ? FlexaoUtil.Genero.FEMININO : FlexaoUtil.Genero.MASCULINO;
        FlexaoUtil.Numero numero = quantidadeLocatarios > 1
                ? FlexaoUtil.Numero.PLURAL
                : FlexaoUtil.Numero.SINGULAR;

        String normalizado = corrigirOsLocatarios(texto);
        Matcher m = TRECHO_LOCATARIO.matcher(normalizado);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String trecho = m.group();
            String ajustado = flexionarLemasNoTrecho(trecho, genero, numero);
            m.appendReplacement(sb, Matcher.quoteReplacement(ajustado));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private static String flexionarLemasNoTrecho(String trecho, FlexaoUtil.Genero genero, FlexaoUtil.Numero numero) {
        String out = trecho;
        for (String lema : LEMAS_REU) {
            out = substituirFormasLema(out, lema, genero, numero);
        }
        return out;
    }

    private static String substituirFormasLema(
            String texto, String lema, FlexaoUtil.Genero genero, FlexaoUtil.Numero numero) {
        Set<String> formas = formasSuperficie(lema);
        String alvo = FlexaoUtil.adequar(lema, genero, numero);
        String resultado = texto;
        for (String forma : formas) {
            if (forma.equalsIgnoreCase(alvo)) {
                continue;
            }
            Pattern p = padraoPalavraIsolada(forma);
            Matcher m = p.matcher(resultado);
            StringBuffer sb = new StringBuffer();
            while (m.find()) {
                String substituicao = reaplicarCaixaSuperficie(m.group(), alvo);
                m.appendReplacement(sb, Matcher.quoteReplacement(substituicao));
            }
            m.appendTail(sb);
            resultado = sb.toString();
        }
        return resultado;
    }

    private static Set<String> formasSuperficie(String lema) {
        Set<String> formas = new LinkedHashSet<>();
        FlexaoUtil.Genero[] generos = {FlexaoUtil.Genero.MASCULINO, FlexaoUtil.Genero.FEMININO};
        FlexaoUtil.Numero[] numeros = {FlexaoUtil.Numero.SINGULAR, FlexaoUtil.Numero.PLURAL};
        for (FlexaoUtil.Genero g : generos) {
            for (FlexaoUtil.Numero n : numeros) {
                formas.add(FlexaoUtil.adequar(lema, g, n));
            }
        }
        return formas;
    }

    private static String injetarLema(String texto, String lema) {
        Pattern p = padraoPalavraIsolada(lema);
        Matcher m = p.matcher(texto);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            m.appendReplacement(sb, Matcher.quoteReplacement("Adequa(\"@\",\"Reu\",\"" + lema + "\")"));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    /**
     * {@code \\b} em Java não trata letras acentuadas como parte da palavra (ASCII-only).
     * Sem isso, «é» em «prévio»/«Também»/«Félix» era flexionado para «são» → «prsãovio», «Fsãolix», etc.
     */
    private static Pattern padraoPalavraIsolada(String palavra) {
        return Pattern.compile(
                "(?<![\\p{L}])" + Pattern.quote(palavra) + "(?![\\p{L}])",
                Pattern.UNICODE_CASE | Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CHARACTER_CLASS);
    }

    private static String corrigirOsLocatarios(String texto) {
        return texto.replaceAll("\\bOS (Locatários|Locatárias)\\b", "Os $1")
                .replaceAll("\\bAS (Locatárias)\\b", "As $1");
    }

    private static String reaplicarCaixaSuperficie(String original, String alvo) {
        if (!StringUtils.hasText(original)) {
            return alvo;
        }
        if (original.equals(original.toUpperCase(Locale.ROOT))
                && !original.equals(original.toLowerCase(Locale.ROOT))) {
            return alvo.toUpperCase(Locale.ROOT);
        }
        if (Character.isUpperCase(original.charAt(0))) {
            if (alvo.isEmpty()) {
                return alvo;
            }
            return Character.toUpperCase(alvo.charAt(0)) + alvo.substring(1);
        }
        return alvo;
    }

    private static Reserva reservarAdequasExistentes(String template) {
        List<String> blocos = new ArrayList<>();
        String texto = template;
        for (int i = 0; i < 100; i++) {
            Matcher wrapped = ADEQUA_UMA_CAMADA.matcher(texto);
            if (wrapped.find()) {
                blocos.add(wrapped.group());
                texto = texto.substring(0, wrapped.start())
                        + "__ADEQUA_RESERVA_"
                        + (blocos.size() - 1)
                        + "__"
                        + texto.substring(wrapped.end());
                continue;
            }
            Matcher simples = ADEQUA_SIMPLES.matcher(texto);
            if (simples.find()) {
                blocos.add(simples.group());
                texto = texto.substring(0, simples.start())
                        + "__ADEQUA_RESERVA_"
                        + (blocos.size() - 1)
                        + "__"
                        + texto.substring(simples.end());
                continue;
            }
            break;
        }
        return new Reserva(texto, blocos, "__ADEQUA_RESERVA_");
    }

    private static Reserva reservar(String texto, Pattern pattern, String prefixoPlaceholder) {
        Matcher m = pattern.matcher(texto);
        List<String> blocos = new ArrayList<>();
        StringBuffer sb = new StringBuffer();
        int i = 0;
        while (m.find()) {
            blocos.add(m.group());
            m.appendReplacement(sb, Matcher.quoteReplacement(prefixoPlaceholder + i++ + "__"));
        }
        m.appendTail(sb);
        return new Reserva(sb.toString(), blocos, prefixoPlaceholder);
    }

    private record Reserva(String texto, List<String> blocos, String prefixo) {
        String restaurar(String t) {
            String out = t;
            for (int i = 0; i < blocos.size(); i++) {
                out = out.replace(prefixo + i + "__", blocos.get(i));
            }
            return out;
        }
    }
}
