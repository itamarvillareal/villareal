package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class ResumoProcessoFinanceiroResponse {

    private BigDecimal saldo;
    private long totalLancamentos;
}
