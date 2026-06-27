package br.com.vilareal.documento;

import br.com.vilareal.topicos.infrastructure.persistence.entity.TopicoEntity;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Interpretação dos blocos legados do modelo de contrato de locação. */
final class ContratoLocacaoBlocoUtil {

    private static final Pattern TAG_PARAG_CLAUSULA =
            Pattern.compile("\\(\"PARAG\\s+CL[ÁA]USULA\"\\)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern TAG_CLAUSULA =
            Pattern.compile("\\(\"CL[ÁA]USULA\"\\)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern TAG_CENTRAL = Pattern.compile("\\(\"CENTRAL\"\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern TAG_CABECALHO = Pattern.compile("\\(\"CABECALHO\"\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PARENS_VAZIOS = Pattern.compile("\\(\\s*\\)");
    private static final Pattern BLOCO_FORMATO_ASPAS =
            Pattern.compile("\\(\"[^\"]*\"(?:\\s*,\\s*\"[^\"]*\")*\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern BLOCO_FORMATO_COMO =
            Pattern.compile("\\(\"[^\"]*\\bcomo\\b[^\"]*\"(?:\\s*,\\s*\"[^\"]*\")*\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern BLOCO_OPCIONAL_TEXTO = Pattern.compile(
            "\\(\"[^\"]*\\bresponsabilidade\\b[^\"]*\"\\)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private ContratoLocacaoBlocoUtil() {}

    static String tituloPadrao() {
        return "CONTRATO DE LOCAÇÃO";
    }

    static boolean isCentral(String template) {
        return StringUtils.hasText(template) && TAG_CENTRAL.matcher(template).find();
    }

    static boolean isCabecalhoFecho(String template) {
        if (!StringUtils.hasText(template) || !TAG_CABECALHO.matcher(template).find()) {
            return false;
        }
        return template.toLowerCase(Locale.ROOT).contains("e por estarem justos e contratados");
    }

    static boolean isCabecalhoMetadados(String template) {
        if (!StringUtils.hasText(template) || !TAG_CABECALHO.matcher(template).find()) {
            return false;
        }
        String lower = template.toLowerCase(Locale.ROOT);
        return !lower.contains("pelo presente instrumento")
                && (template.contains("+++") || lower.contains("como locador") || lower.contains("nome(\"autor\""));
    }

    /** Bloco do preâmbulo (partes) — processado via template legado (Autor antes de Réu). */
    static boolean isBlocoPreambuloInstrumento(String template) {
        if (!StringUtils.hasText(template)) {
            return false;
        }
        return template.toLowerCase(Locale.ROOT).contains("pelo presente instrumento");
    }

    static boolean isParagrafoClausula(String template, TopicoEntity bloco) {
        if (StringUtils.hasText(bloco != null ? bloco.getTipoFormatacao() : null)
                && "PARAG_CLAUSULA".equalsIgnoreCase(bloco.getTipoFormatacao().trim())) {
            return true;
        }
        return StringUtils.hasText(template) && TAG_PARAG_CLAUSULA.matcher(template).find();
    }

    static boolean isClausulaPrincipal(String template, TopicoEntity bloco) {
        if (isParagrafoClausula(template, bloco)) {
            return false;
        }
        if (StringUtils.hasText(bloco != null ? bloco.getTipoFormatacao() : null)) {
            String tipo = bloco.getTipoFormatacao().trim();
            if ("CLAUSULA".equalsIgnoreCase(tipo) || "TITULO_CLAUSULA".equalsIgnoreCase(tipo)) {
                return true;
            }
        }
        return StringUtils.hasText(template) && TAG_CLAUSULA.matcher(template).find();
    }

    static String extrairTituloCentral(String template) {
        if (!StringUtils.hasText(template)) {
            return tituloPadrao();
        }
        String t = template;
        t = TAG_CENTRAL.matcher(t).replaceAll("");
        t = PARENS_VAZIOS.matcher(t).replaceAll("");
        t = t.replaceAll("\\s+", " ").trim();
        return StringUtils.hasText(t) ? t : tituloPadrao();
    }

    static String limparMetadadosFormato(String texto) {
        if (!StringUtils.hasText(texto)) {
            return texto != null ? texto : "";
        }
        String t = texto.trim();
        for (int i = 0; i < 6; i++) {
            Matcher m = BLOCO_FORMATO_ASPAS.matcher(t);
            if (!m.lookingAt()) {
                break;
            }
            String bloco = m.group();
            if (!pareceMetadadoFormato(bloco)) {
                break;
            }
            t = m.replaceFirst("").trim();
        }
        t = BLOCO_FORMATO_COMO.matcher(t).replaceAll("");
        t = BLOCO_OPCIONAL_TEXTO.matcher(t).replaceAll("");
        return t.trim();
    }

    /** Cláusula sobre votação em assembleia condominial (modelo legado duplicado no bloco 48). */
    static boolean isClausulaVotacaoAssembleiaCondominial(String texto) {
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        return texto.toLowerCase(Locale.ROOT).contains("votação em assembleias condominiais");
    }

    static boolean pareceClausulaFiador(String template, TopicoEntity bloco) {
        if (!StringUtils.hasText(template)) {
            return false;
        }
        String t = template.toLowerCase(Locale.ROOT);
        if (t.contains("adequa(\"@\",\"fiador\"")
                || t.contains("adequa(\"@\", \"fiador\"")
                || t.contains("qualifica(\"fiador\"")
                || t.contains("nome(\"fiador\"")
                || t.contains("+++a fiadora")) {
            return true;
        }
        if (bloco != null && StringUtils.hasText(bloco.getNome())) {
            String nome = bloco.getNome().toLowerCase(Locale.ROOT);
            if (nome.contains("fiador") || nome.contains("fiadora")) {
                return true;
            }
        }
        return false;
    }

    static String prefixoClausulaHtml(int numero) {
        return "<strong>Cláusula " + numero + "ª.</strong> ";
    }

    private static boolean pareceMetadadoFormato(String bloco) {
        String lower = bloco.toLowerCase(Locale.ROOT);
        return lower.contains("como ")
                || lower.contains("nome(\"autor\"")
                || lower.contains("nome(\"reu\"")
                || lower.contains("adequa(")
                || lower.contains("locador")
                || lower.contains("locat");
    }
}
