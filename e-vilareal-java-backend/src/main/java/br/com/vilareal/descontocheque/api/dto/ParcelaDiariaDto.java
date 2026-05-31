package br.com.vilareal.descontocheque.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Uma linha da tabela diária do desconto de cheque. */
@Getter
@Setter
public class ParcelaDiariaDto {

    private int dia;
    private LocalDate data;
    private BigDecimal saldo;
    private BigDecimal jurosDia;
    private BigDecimal jurosAcumulado;
}
