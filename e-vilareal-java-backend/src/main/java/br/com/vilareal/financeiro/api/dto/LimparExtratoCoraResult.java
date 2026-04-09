package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LimparExtratoCoraResult {

    /** Lançamentos apagados (banco_nome normalizado = CORA). */
    private int lancamentosRemovidosCora;

    /**
     * Lançamentos em outros bancos (exclui CORA) com o mesmo {@code elo_financeiro_id} que algum lançamento Cora;
     * elo removido, conta para «N», cliente e processo desvinculados, eq_referencia limpa.
     */
    private int lancamentosDesvinculadosOutrosBancos;
}
