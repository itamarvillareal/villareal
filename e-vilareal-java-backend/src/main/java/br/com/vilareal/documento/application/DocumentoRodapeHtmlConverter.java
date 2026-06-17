package br.com.vilareal.documento.application;

import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Converte {@code rodape_texto} (linhas plain-text) em HTML com classes fixas do layout. */
public final class DocumentoRodapeHtmlConverter {

    private DocumentoRodapeHtmlConverter() {}

    public static String primeiraPagina(String rodapeTexto) {
        return montarHtml(linhas(rodapeTexto), 1);
    }

    /** Páginas seguintes: omite linhas de telefone (mesma regra do rodapé corrido Villa Real). */
    public static String paginasSeguintes(String rodapeTexto) {
        List<String> filtradas = new ArrayList<>();
        for (String linha : linhas(rodapeTexto)) {
            if (pareceLinhaTelefone(linha)) {
                continue;
            }
            filtradas.add(linha);
        }
        return montarHtml(filtradas, 1);
    }

    private static List<String> linhas(String rodapeTexto) {
        List<String> out = new ArrayList<>();
        if (!StringUtils.hasText(rodapeTexto)) {
            return out;
        }
        for (String bruta : rodapeTexto.split("\\R")) {
            String linha = bruta.trim();
            if (!linha.isEmpty()) {
                out.add(linha);
            }
        }
        return out;
    }

    private static boolean pareceLinhaTelefone(String linha) {
        String t = linha.toLowerCase(Locale.ROOT);
        return t.contains("telefone");
    }

    private static String montarHtml(List<String> linhas, int indiceInicialClasse) {
        if (linhas.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        int classe = indiceInicialClasse;
        for (String linha : linhas) {
            sb.append("<p class=\"rodape-linha").append(classe).append("\">")
                    .append(escapeHtml(linha))
                    .append("</p>");
            classe++;
        }
        return sb.toString();
    }

    private static String escapeHtml(String texto) {
        return texto.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
