package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CartaoResponse {
    private Long id;
    private String nome;
    private Integer numeroCartao;
    private Boolean ativo;
    private Integer ordemExibicao;
}
