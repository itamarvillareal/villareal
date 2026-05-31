package br.com.vilareal.descontocheque.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class DescontoChequeResponse {

    /** Nulo quando vem de /simular (não persistido). */
    private Long id;
    private String descricao;
    private BigDecimal valorFace;
    private LocalDate dataBase;
    private LocalDate dataDeposito;
    private BigDecimal taxaMensalPercentual;
    private int dias;
    private BigDecimal taxaDiaria;
    private BigDecimal valorLiquido;
    private BigDecimal valorDesconto;
    private List<ParcelaDiariaDto> parcelasDiarias;
    private Instant createdAt;
    private Instant updatedAt;
}
