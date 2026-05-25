package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FinanceiroSaudeIndicadorDto {
    private long total;
    private double percentual;
}
