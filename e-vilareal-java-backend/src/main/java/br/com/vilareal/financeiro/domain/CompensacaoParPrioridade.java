package br.com.vilareal.financeiro.domain;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;

import java.util.Locale;
import java.util.Objects;

/**
 * Prioriza sugestões de compensação: mesma família de movimento (PIX↔PIX, transf↔transf),
 * depois contas bancárias diferentes; por último mesmo banco só por valor/data.
 */
public final class CompensacaoParPrioridade {

    public static final int PESO_MESMA_FAMILIA_MOVIMENTO = 100;
    public static final int PESO_BANCOS_DIFERENTES = 60;
    public static final int PESO_MESMO_BANCO = 10;

    private CompensacaoParPrioridade() {}

    public enum FamiliaMovimento {
        PIX,
        TRANSFERENCIA,
        DEPOSITO,
        DOC_TED,
        OUTRO
    }

    public static FamiliaMovimento classificarFamiliaMovimento(String descricao, String descricaoDetalhada) {
        String texto = normalizarTexto(descricao) + " " + normalizarTexto(descricaoDetalhada);
        if (texto.isBlank()) {
            return FamiliaMovimento.OUTRO;
        }
        if (texto.contains("pix")) {
            return FamiliaMovimento.PIX;
        }
        if (texto.contains("transf") || texto.contains("transfer")) {
            return FamiliaMovimento.TRANSFERENCIA;
        }
        if (texto.contains("deposito") || texto.contains("deposit")) {
            return FamiliaMovimento.DEPOSITO;
        }
        if (texto.contains(" doc ") || texto.startsWith("doc ") || texto.contains(" ted ")) {
            return FamiliaMovimento.DOC_TED;
        }
        return FamiliaMovimento.OUTRO;
    }

    public static boolean mesmaFamiliaMovimento(FamiliaMovimento a, FamiliaMovimento b) {
        if (a == FamiliaMovimento.OUTRO || b == FamiliaMovimento.OUTRO) {
            return false;
        }
        return a == b;
    }

    public static boolean bancosDiferentes(LancamentoFinanceiroEntity a, LancamentoFinanceiroEntity b) {
        Integer nbA = a != null ? a.getNumeroBanco() : null;
        Integer nbB = b != null ? b.getNumeroBanco() : null;
        if (nbA == null || nbB == null) {
            return false;
        }
        return !Objects.equals(nbA, nbB);
    }

    public static int pontuar(LancamentoFinanceiroEntity a, LancamentoFinanceiroEntity b) {
        if (a == null || b == null) {
            return 0;
        }
        int score = 0;
        FamiliaMovimento fa = classificarFamiliaMovimento(a.getDescricao(), a.getDescricaoDetalhada());
        FamiliaMovimento fb = classificarFamiliaMovimento(b.getDescricao(), b.getDescricaoDetalhada());
        if (mesmaFamiliaMovimento(fa, fb)) {
            score += PESO_MESMA_FAMILIA_MOVIMENTO;
        }
        if (bancosDiferentes(a, b)) {
            score += PESO_BANCOS_DIFERENTES;
        } else {
            score += PESO_MESMO_BANCO;
        }
        return score;
    }

    private static String normalizarTexto(String s) {
        if (s == null) {
            return "";
        }
        return " " + s.toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ") + " ";
    }
}
