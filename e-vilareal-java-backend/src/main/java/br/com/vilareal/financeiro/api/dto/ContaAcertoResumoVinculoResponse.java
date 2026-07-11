package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** Recorte por vínculo (cliente ou pessoa/imóvel) do resumo da conta de acerto (CONTA ZERO). */
@Getter
@Setter
public class ContaAcertoResumoVinculoResponse {

    /** PK da tabela cliente (quando o vínculo é por cliente). */
    private Long clienteId;
    private String codigoCliente;
    /** pessoa.id (quando o vínculo é direto por pessoa/imóvel, sem cliente). */
    private Long pessoaRefId;
    private String nome;
    private long totalLancamentos;
    /** Lançamentos sem grupo de compensação (pendências do acerto). */
    private long pendentes;
    /** Soma assinada (crédito − débito) de todos os lançamentos do vínculo. */
    private BigDecimal saldo;
    /** Soma assinada só dos pendentes — o saldo do acerto (quem deve a quem). */
    private BigDecimal saldoPendente;
}
