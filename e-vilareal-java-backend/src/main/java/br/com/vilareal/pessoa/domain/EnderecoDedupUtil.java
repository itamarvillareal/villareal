package br.com.vilareal.pessoa.domain;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEnderecoEntity;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Chave natural para deduplicação de endereços da mesma pessoa (rua + CEP normalizados). */
public final class EnderecoDedupUtil {

    private static final Pattern ESPACOS_MULTIPLOS = Pattern.compile("\\s+");

    private EnderecoDedupUtil() {}

    public static String chave(String rua, String cep) {
        String ruaNorm = normalizarTexto(rua);
        String cepNorm = cep != null ? cep.replaceAll("\\D", "") : "";
        return ruaNorm + "|" + cepNorm;
    }

    public static String chave(PessoaEnderecoEntity e) {
        if (e == null) {
            return "|";
        }
        return chave(e.getRua(), e.getCep());
    }

    /**
     * trim → maiúsculas → remove acentos (NFD) → colapsa espaços.
     * Mesma técnica de {@code JuliaTriagemDedupUtil#normalizarTextoDedup}, adaptada para chaves de endereço.
     */
    public static String normalizarTexto(String s) {
        if (!StringUtils.hasText(s)) {
            return "";
        }
        String semAcento = Normalizer.normalize(s.trim().toUpperCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return ESPACOS_MULTIPLOS.matcher(semAcento).replaceAll(" ").trim();
    }
}
