package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class SaldoBancoMensalResponse {

    private Integer numeroBanco;
    private int ano;
    private int mes;
    /** Saldo ao fim do último dia do mês anterior (base do acumulado no mês). */
    private BigDecimal saldoInicial;
    private List<SaldoBancoDiaResponse> dias = new ArrayList<>();
}
