package br.com.vilareal.demanda.application;

import br.com.vilareal.demanda.infrastructure.persistence.entity.DemandaEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.Locale;

final class DemandaBuscaSupport {

    private DemandaBuscaSupport() {}

    static boolean matches(DemandaEntity d, String buscaNorm) {
        if (d == null || !StringUtils.hasText(buscaNorm)) {
            return true;
        }
        String haystack = buildHaystack(d);
        return tokensMatch(haystack, buscaNorm);
    }

    private static String buildHaystack(DemandaEntity d) {
        StringBuilder sb = new StringBuilder();
        append(sb, d.getDescricao());
        append(sb, d.getFornecedorTexto());
        append(sb, d.getCategoria());

        ImovelEntity im = d.getImovel();
        if (im != null) {
            append(sb, im.getTitulo());
            append(sb, im.getCondominio());
            append(sb, im.getUnidade());
            append(sb, im.getEnderecoCompleto());
            if (im.getNumeroPlanilha() != null) {
                append(sb, String.valueOf(im.getNumeroPlanilha()));
            }
            if (im.getId() != null) {
                append(sb, String.valueOf(im.getId()));
            }
        }

        ClienteEntity cl = d.getCliente();
        if (cl != null) {
            append(sb, cl.getNomeReferencia());
            append(sb, cl.getCodigoCliente());
            if (cl.getPessoa() != null) {
                append(sb, cl.getPessoa().getNome());
            }
        }
        return normalize(sb.toString());
    }

    private static void append(StringBuilder sb, String value) {
        if (!StringUtils.hasText(value)) {
            return;
        }
        if (!sb.isEmpty()) {
            sb.append(' ');
        }
        sb.append(value.trim());
    }

    /** Cada token da busca deve aparecer no haystack (E entre palavras). */
    private static boolean tokensMatch(String haystackNorm, String buscaNorm) {
        String[] tokens = normalize(buscaNorm).split("\\s+");
        for (String token : tokens) {
            if (token.isEmpty()) {
                continue;
            }
            if (!haystackNorm.contains(token)) {
                return false;
            }
        }
        return true;
    }

    private static String normalize(String s) {
        if (s == null) {
            return "";
        }
        String nfd = Normalizer.normalize(s, Normalizer.Form.NFD);
        return nfd.replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT).trim();
    }
}
