package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FinanceiroSaudeMesAbertoDto {
    private int ano;
    private int mes;
    private long pendentes;
    private long total;
    private double percentualCompleto;
}
