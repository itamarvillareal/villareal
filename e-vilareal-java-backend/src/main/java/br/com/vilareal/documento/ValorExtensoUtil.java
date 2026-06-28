package br.com.vilareal.documento;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Utilitário puro de "por extenso" em pt-BR: valores em reais e cardinais.
 *
 * <p>Classe {@code final}, métodos estáticos, sem Spring/banco.
 */
public final class ValorExtensoUtil {

    private ValorExtensoUtil() {
    }

    private static final String[] UNIDADES = {
            "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
            "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"
    };

    private static final String[] DEZENAS = {
            "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"
    };

    private static final String[] CENTENAS = {
            "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
            "seiscentos", "setecentos", "oitocentos", "novecentos"
    };

    /** Ex.: {@code 1234.56} → {@code "mil duzentos e trinta e quatro reais e cinquenta e seis centavos"}. */
    public static String reaisPorExtenso(BigDecimal valor) {
        BigDecimal v = (valor == null ? BigDecimal.ZERO : valor).setScale(2, RoundingMode.HALF_UP);
        long reais = v.longValue();
        int centavos = v.remainder(BigDecimal.ONE).movePointRight(2).abs().intValue();

        StringBuilder sb = new StringBuilder();
        if (reais > 0) {
            sb.append(numeroPorExtenso(reais));
            // "de reais" para milhões/bilhões exatos (ex.: "um milhão de reais").
            boolean usaDe = reais >= 1_000_000 && reais % 1_000_000 == 0;
            if (usaDe) {
                sb.append(" de reais");
            } else {
                sb.append(reais == 1 ? " real" : " reais");
            }
        }
        if (centavos > 0) {
            if (sb.length() > 0) {
                sb.append(" e ");
            }
            sb.append(numeroPorExtenso(centavos)).append(centavos == 1 ? " centavo" : " centavos");
        }
        if (sb.length() == 0) {
            return "zero reais";
        }
        return sb.toString();
    }

    /** Ex.: {@code 30} → {@code "trinta"} (cardinal, sem "reais"). */
    public static String numeroPorExtenso(long numero) {
        if (numero == 0) {
            return "zero";
        }
        if (numero < 0 || numero > 999_999_999) {
            return Long.toString(numero);
        }
        int milhoes = (int) (numero / 1_000_000);
        int milhares = (int) ((numero / 1000) % 1000);
        int centenas = (int) (numero % 1000);

        List<String> partes = new ArrayList<>();
        if (milhoes > 0) {
            partes.add(milhoes == 1 ? "um milhão" : tresDigitos(milhoes) + " milhões");
        }
        if (milhares > 0) {
            // PT-BR: 1000 = "mil" (não "um mil"); 2000 = "dois mil", 21000 = "vinte e um mil".
            partes.add(milhares == 1 ? "mil" : tresDigitos(milhares) + " mil");
        }
        if (centenas > 0) {
            partes.add(tresDigitos(centenas));
        }

        if (partes.size() == 1) {
            return partes.get(0);
        }

        // Regra do "e": liga o último grupo quando ele é < 100 ou múltiplo exato de 100.
        boolean usarE = centenas > 0 ? (centenas < 100 || centenas % 100 == 0) : true;
        String ultimo = partes.get(partes.size() - 1);
        String cabeca = String.join(" ", partes.subList(0, partes.size() - 1));
        return cabeca + (usarE ? " e " : " ") + ultimo;
    }

    /** Cardinal de um grupo de três dígitos (1..999). */
    private static String tresDigitos(int v) {
        if (v == 100) {
            return "cem";
        }
        StringBuilder sb = new StringBuilder();
        int c = v / 100;
        int resto = v % 100;
        if (c > 0) {
            sb.append(CENTENAS[c]);
        }
        if (resto > 0) {
            if (c > 0) {
                sb.append(" e ");
            }
            if (resto < 20) {
                sb.append(UNIDADES[resto]);
            } else {
                int d = resto / 10;
                int u = resto % 10;
                sb.append(DEZENAS[d]);
                if (u > 0) {
                    sb.append(" e ").append(UNIDADES[u]);
                }
            }
        }
        return sb.toString();
    }
}
