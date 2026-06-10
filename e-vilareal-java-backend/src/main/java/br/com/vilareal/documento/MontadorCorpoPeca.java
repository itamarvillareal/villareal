package br.com.vilareal.documento;

import java.util.ArrayList;
import java.util.List;

/**
 * Monta o HTML do corpo de uma peça a partir dos blocos de tópico (formato novo: classe + HTML com
 * tokens), resolvendo os tokens com o {@link TopicoTokenResolver.ProcessamentoContexto}, descartando
 * blocos que ficam vazios e envolvendo cada bloco restante em {@code <p class="{classe}">…</p>}.
 *
 * <p>Não resolve {@code {{debitos:…}}} (o resolvedor o preserva); o capítulo de débitos é montado à
 * parte na fase de integração. Aqui processamos apenas blocos de texto (Fatos, Direito, etc.).
 */
public final class MontadorCorpoPeca {

    private static final String CLASSE_PADRAO = "paragrafo";

    private MontadorCorpoPeca() {
    }

    /** classe = {@code classe_html}; html = {@code conteudo_html} do bloco. */
    public record BlocoTopico(String classe, String html) {
    }

    public static String processarBlocos(
            List<BlocoTopico> blocos, TopicoTokenResolver.ProcessamentoContexto ctx) {
        if (blocos == null || blocos.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (BlocoTopico bloco : blocos) {
            if (bloco == null) {
                continue;
            }
            String htmlResolvido = TopicoTokenResolver.resolver(bloco.html(), ctx);
            if (vazio(htmlResolvido)) {
                continue;
            }
            String classe = bloco.classe() == null || bloco.classe().isBlank()
                    ? CLASSE_PADRAO
                    : bloco.classe().trim();
            sb.append("<p class=\"").append(classe).append("\">").append(htmlResolvido).append("</p>");
        }
        return sb.toString();
    }

    /** Blocos cuja {@code classe} coincide (após trim); ordem original preservada. */
    public static List<BlocoTopico> extrairBlocosPorClasse(List<BlocoTopico> blocos, String classe) {
        if (blocos == null || blocos.isEmpty() || classe == null || classe.isBlank()) {
            return List.of();
        }
        String alvo = classe.trim();
        List<BlocoTopico> filtrados = new ArrayList<>();
        for (BlocoTopico bloco : blocos) {
            if (bloco != null && alvo.equals(normalizarClasse(bloco.classe()))) {
                filtrados.add(bloco);
            }
        }
        return filtrados;
    }

    /** Processa blocos cuja classe não está em {@code classesExcluir}. */
    public static String processarBlocosExcluindo(
            List<BlocoTopico> blocos,
            TopicoTokenResolver.ProcessamentoContexto ctx,
            String... classesExcluir) {
        if (blocos == null || blocos.isEmpty()) {
            return "";
        }
        List<BlocoTopico> filtrados = new ArrayList<>();
        for (BlocoTopico bloco : blocos) {
            if (bloco == null || deveExcluir(bloco.classe(), classesExcluir)) {
                continue;
            }
            filtrados.add(bloco);
        }
        return processarBlocos(filtrados, ctx);
    }

    private static boolean deveExcluir(String classe, String... classesExcluir) {
        if (classesExcluir == null || classesExcluir.length == 0) {
            return false;
        }
        String norm = normalizarClasse(classe);
        for (String ex : classesExcluir) {
            if (ex != null && norm.equals(ex.trim())) {
                return true;
            }
        }
        return false;
    }

    private static String normalizarClasse(String classe) {
        return classe == null || classe.isBlank() ? CLASSE_PADRAO : classe.trim();
    }

    /** Verdadeiro se, removidas as tags HTML e os espaços, não sobrar conteúdo visível. */
    private static boolean vazio(String html) {
        if (html == null) {
            return true;
        }
        String semTags = html.replaceAll("<[^>]*>", "");
        // Normaliza entidades de espaço comuns antes de medir.
        semTags = semTags.replace("&nbsp;", " ");
        return semTags.strip().isEmpty();
    }
}
