package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Ficha do Acerto por cliente (Etapa 5b): regras do acordo + mensalidade referenciada do cadastro
 * mensalista + último fechamento derivado do último acerto FECHADO.
 */
@Getter
@Setter
public class AcertoClienteConfigResponse {

    private Long clienteId;
    private String codigoCliente;
    private String clienteNome;
    private BigDecimal percentualRepasse;
    private String observacoes;

    /** Mensalidade vigente (referência ao cadastro mensalista; não duplicada). */
    private BigDecimal mensalidadeValor;
    private Integer mensalidadeDiaVencimento;
    private Boolean mensalistaAtivo;

    /** Último fechamento (derivado do último acerto FECHADO do cliente na conta). */
    private Long ultimoFechamentoId;
    private Instant ultimoFechamentoData;
    private BigDecimal ultimoFechamentoSaldo;
    private LocalDate ultimoFechamentoPeriodoFim;
}
