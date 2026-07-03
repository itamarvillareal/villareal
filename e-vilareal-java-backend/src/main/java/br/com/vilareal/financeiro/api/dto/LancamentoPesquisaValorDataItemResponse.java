package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

/** Item da pesquisa por valor+data exatos (inclui flag de extrato bloqueado ao usuário). */
@Getter
@Setter
public class LancamentoPesquisaValorDataItemResponse {

    private LancamentoExtratoListItemResponse lancamento;
    /** true quando o banco de origem não está no extrato permitido ao usuário (ex.: Karla × BTG). */
    private boolean extratoBloqueado;
}
