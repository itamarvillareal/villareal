package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class RecorrenciaLancamentoPreviewItem {

    private LocalDate dataLancamento;
    private String descricao;
    private BigDecimal valor;
    /** {@code NOVO} ou {@code COMPLETAR}. */
    private String acao;
}
