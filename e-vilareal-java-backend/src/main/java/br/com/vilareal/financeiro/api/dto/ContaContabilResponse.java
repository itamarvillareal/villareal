package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ContaContabilResponse {

    private Long id;
    private String nome;
    private String codigo;
}
