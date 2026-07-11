package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class ParearGrupoCompensacaoResponse {

    private String grupoCompensacao;
    private int lancamentos;
    /** Soma assinada (crédito − débito) do grupo após o pareamento. */
    private BigDecimal soma;
}
