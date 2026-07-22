package br.com.vilareal.documento;

import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.Collection;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Numeração padronizada de arquivos no Drive:
 * {@code 01.*} — petições geradas pelo sistema (pasta «Assinar» do processo);
 * {@code 02+.*} — documentos constitutivos assinados (.p7s) na pasta Pessoas/Assinados.
 */
public final class DocumentoNomeNumeracaoUtil {

    static final int PREFIXO_PETICAO = 1;
    static final int PREFIXO_PESSOA_ASSINADOS_MINIMO = 2;

    private static final Pattern PREFIXO_NUMERICO = Pattern.compile("^(\\d{2})\\.");

    private DocumentoNomeNumeracaoUtil() {}

    /** Ex.: {@code 01.PeticaoInicial} → sanitizado com extensão .pdf pelo Drive. */
    public static String formatarNomeArquivoPeticao(String tipoPeca, LocalDate data) {
        String rotulo = rotuloCompactoPeticao(tipoPeca);
        String base = "01.Peticao" + rotulo;
        return GoogleDriveService.sanitizarNomeArquivo(base);
    }

    public static String formatarNomePessoaAssinado(int numero, String descricaoBase) {
        int n = Math.max(numero, PREFIXO_PESSOA_ASSINADOS_MINIMO);
        String descricao = sanitizarDescricaoArquivo(descricaoBase);
        if (!StringUtils.hasText(descricao)) {
            descricao = "Documento";
        }
        return String.format("%02d.%s.pdf.p7s", n, descricao);
    }

    public static String formatarNomePessoaAssinadoPdf(int numero, String descricaoBase) {
        String p7s = formatarNomePessoaAssinado(numero, descricaoBase);
        if (p7s.toLowerCase().endsWith(".pdf.p7s")) {
            return p7s.substring(0, p7s.length() - 4);
        }
        return p7s.replaceAll("(?i)\\.p7s$", "");
    }

    public static int calcularProximoNumeroPessoaAssinados(Collection<String> nomesExistentes) {
        int max = PREFIXO_PETICAO;
        if (nomesExistentes != null) {
            for (String nome : nomesExistentes) {
                int prefixo = extrairPrefixoNumerico(nome);
                if (prefixo > max) {
                    max = prefixo;
                }
            }
        }
        return Math.max(max + 1, PREFIXO_PESSOA_ASSINADOS_MINIMO);
    }

    public static int extrairPrefixoNumerico(String nomeArquivo) {
        if (!StringUtils.hasText(nomeArquivo)) {
            return 0;
        }
        Matcher m = PREFIXO_NUMERICO.matcher(nomeArquivo.trim());
        if (!m.find()) {
            return 0;
        }
        try {
            return Integer.parseInt(m.group(1));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** Extrai descrição de nomes como {@code 02.Procuracao.pdf.p7s} ou upload bruto. */
    public static String extrairDescricaoBase(String nomeOriginal) {
        if (!StringUtils.hasText(nomeOriginal)) {
            return "Documento";
        }
        String nome = nomeOriginal.trim();
        if (nome.toLowerCase().endsWith(".pdf.p7s")) {
            nome = nome.substring(0, nome.length() - 8);
        } else if (nome.toLowerCase().endsWith(".p7s")) {
            nome = nome.substring(0, nome.length() - 4);
        }
        Matcher m = PREFIXO_NUMERICO.matcher(nome);
        if (m.find()) {
            nome = nome.substring(m.end());
        }
        if (nome.toLowerCase().endsWith(".pdf")) {
            nome = nome.substring(0, nome.length() - 4);
        }
        return sanitizarDescricaoArquivo(nome);
    }

    static String rotuloCompactoPeticao(String tipoPeca) {
        if (!StringUtils.hasText(tipoPeca)) {
            return "Inicial";
        }
        String tipo = tipoPeca.trim();
        if (tipo.equalsIgnoreCase("Peticao") || tipo.equalsIgnoreCase("Petição")) {
            return "Inicial";
        }
        if (tipo.equalsIgnoreCase("Documento_Formatado") || tipo.equalsIgnoreCase("Documento Formatado")) {
            return "Formatada";
        }
        return sanitizarDescricaoArquivo(tipo.replaceAll("[\\s_-]+", ""));
    }

    private static String sanitizarDescricaoArquivo(String valor) {
        if (!StringUtils.hasText(valor)) {
            return "";
        }
        String limpo = valor.trim().replaceAll("[^a-zA-Z0-9._\\- ]", " ").replaceAll("\\s+", " ").trim();
        if (!StringUtils.hasText(limpo)) {
            return "";
        }
        return limpo.replace(' ', '_');
    }
}
