package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LimparExtratoResult {

    /** Lançamentos apagados do extrato do banco indicado (nome normalizado). */
    private int lancamentosRemovidos;

    /** Sempre 0 após remoção de {@code elo_financeiro_id} (V34); mantido na API por compatibilidade. */
    private int lancamentosDesvinculadosOutrosBancos;
}
