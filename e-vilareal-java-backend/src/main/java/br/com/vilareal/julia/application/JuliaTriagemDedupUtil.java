package br.com.vilareal.julia.application;

import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Fingerprints e heurísticas anti-duplicação (e-mail PROJUDI + web, andamentos genéricos). */
final class JuliaTriagemDedupUtil {

    private static final Pattern NAO_ALFANUM = Pattern.compile("[^a-z0-9]+");

    private static final String[] CLASSIFICACOES_GENERICAS = {
        "informacao de intimacao citacao",
        "intimacao citacao",
        "informacao de intimacao",
        "intimacao",
        "citacao",
        "movimentacao projudi",
        "triagem julia"
    };

    private JuliaTriagemDedupUtil() {}

    static String normalizarTextoDedup(String s) {
        if (!StringUtils.hasText(s)) {
            return "";
        }
        String n = Normalizer.normalize(s.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return NAO_ALFANUM.matcher(n).replaceAll(" ").trim();
    }

    static boolean classificacaoEhGenerica(String classificacao) {
        String norm = normalizarTextoDedup(classificacao);
        if (norm.isEmpty()) {
            return true;
        }
        for (String g : CLASSIFICACOES_GENERICAS) {
            if (norm.equals(g) || norm.startsWith(g + " ") || norm.contains(" via sistema projudi")) {
                return true;
            }
        }
        return norm.length() < 12;
    }

    /**
     * Chave estável para detectar triagens/andamentos repetidos do mesmo fato (cross-pipeline).
     */
    static String fingerprintMovimentacao(PublicacaoEntity publicacao, String classificacao, String resumo) {
        StringBuilder sb = new StringBuilder();
        if (publicacao != null) {
            if (StringUtils.hasText(publicacao.getTipoPublicacao())) {
                sb.append(publicacao.getTipoPublicacao().trim()).append('|');
            }
            if (publicacao.getDataPublicacao() != null) {
                sb.append(publicacao.getDataPublicacao()).append('|');
            }
        }
        String classNorm = normalizarTextoDedup(classificacao);
        if (classificacaoEhGenerica(classificacao)) {
            classNorm = "generico_intimacao";
        }
        sb.append(classNorm).append('|');
        String resumoNorm = normalizarTextoDedup(resumo);
        if (resumoNorm.length() > 120) {
            resumoNorm = resumoNorm.substring(0, 120);
        }
        sb.append(resumoNorm);
        return sb.toString();
    }

    static boolean titulosAndamentoEquivalentes(String tituloA, String tituloB) {
        String a = normalizarTextoDedup(tituloA);
        String b = normalizarTextoDedup(tituloB);
        if (a.isEmpty() || b.isEmpty()) {
            return false;
        }
        if (a.equals(b)) {
            return true;
        }
        if (classificacaoEhGenerica(tituloA) && classificacaoEhGenerica(tituloB)) {
            return true;
        }
        return a.length() >= 20 && b.length() >= 20 && (a.contains(b) || b.contains(a));
    }
}
