package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class ResumoMensalContaResponse {

    private String contaCodigo;
    private String contaNome;
    private int ano;
    private int mes;
    private BigDecimal saldoMes;
    private long quantidadeLancamentos;
}
