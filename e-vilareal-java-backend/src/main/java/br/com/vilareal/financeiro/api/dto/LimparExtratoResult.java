package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LimparExtratoResult {

    /** Lançamentos apagados do extrato do banco indicado (nome normalizado). */
    private int lancamentosRemovidos;

    /**
     * Lançamentos noutros bancos que partilhavam {@code elo_financeiro_id} com algum lançamento desse extrato;
     * elo removido, conta para «N», cliente e processo desvinculados, eq_referencia limpa.
     */
    private int lancamentosDesvinculadosOutrosBancos;
}
