package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class PagamentoFaturaVinculoResponse {

    private Long id;
    private Long lancamentoBancoId;
    private String bancoNome;
    private LocalDate dataBanco;
    private BigDecimal valorBanco;
    private String naturezaBanco;
    private String descricaoBanco;
    private Long lancamentoCartaoId;
    private String cartaoNome;
    private LocalDate dataCartao;
    private BigDecimal valorCartao;
    private String descricaoCartao;
}
