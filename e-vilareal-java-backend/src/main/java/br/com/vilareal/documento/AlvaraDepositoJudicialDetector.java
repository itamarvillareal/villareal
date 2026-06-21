package br.com.vilareal.documento;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Reconhece créditos prováveis de alvará / depósito judicial — espelha regra V49
 * ({@code %deposito judicial%}) e heurística da Conta Corrente do processo, acrescida de
 * {@code alvar*} e {@code levantamento}.
 */
public final class AlvaraDepositoJudicialDetector {

    /** Seed V49 — {@code financeiro_regra_classificacao.padrao_descricao}. */
    public static final String PADRAO_V49_DEPOSITO_JUDICIAL = "%deposito judicial%";

    /** Subconjunto da heurística de entrada em {@code contaCorrenteProcessoResultado.js}. */
    private static final Pattern CC_DEPOSITO_OU_JUDICIAL =
            Pattern.compile("\\b(DEPOSITO|DEPÓSITO|JUDICIAL)\\b", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private AlvaraDepositoJudicialDetector() {}

    public static String textoLancamento(LancamentoFinanceiroEntity l) {
        if (l == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        if (StringUtils.hasText(l.getDescricaoNorm())) {
            sb.append(l.getDescricaoNorm().trim()).append(' ');
        }
        if (StringUtils.hasText(l.getDescricao())) {
            sb.append(l.getDescricao().trim()).append(' ');
        }
        return sb.toString().trim();
    }

    /** {@code true} quando a descrição casa V49 e/ou termos de alvará/levantamento. */
    public static boolean pareceDepositoJudicialOuAlvara(LancamentoFinanceiroEntity l) {
        return pareceDepositoJudicialOuAlvara(textoLancamento(l));
    }

    public static boolean pareceDepositoJudicialOuAlvara(String texto) {
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        String norm = normalizar(texto);
        if (norm.contains("DEPOSITO JUDICIAL")) {
            return true;
        }
        if (norm.contains("ALVAR")) {
            return true;
        }
        if (norm.contains("LEVANTAMENTO")) {
            return true;
        }
        boolean temDeposito = norm.contains("DEPOSITO");
        boolean temJudicial = norm.contains("JUDICIAL");
        if (temDeposito && temJudicial) {
            return true;
        }
        return CC_DEPOSITO_OU_JUDICIAL.matcher(texto).find() && temDeposito && temJudicial;
    }

    static String normalizar(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT);
    }
}
