package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class SaldoBancoDiaResponse {

    private LocalDate data;
    private BigDecimal movimento;
    /** Saldo acumulado ao fim deste dia (histórico completo até a data, inclusive). */
    private BigDecimal saldo;
    private long lancamentosNoDia;
}
