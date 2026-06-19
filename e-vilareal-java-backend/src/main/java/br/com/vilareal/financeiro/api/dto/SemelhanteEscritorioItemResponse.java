package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class SemelhanteEscritorioItemResponse {

    private Long lancamentoId;
    private LocalDate dataLancamento;
    private String descricao;
    private BigDecimal valor;
    private String bancoNome;

    private Long contaContabilId;
    private String contaCodigo;

    private Long sugestaoClienteId;
    private String sugestaoCodigoCliente;
    private String sugestaoClienteNome;
    private Long sugestaoProcessoId;
    private String sugestaoProcessoNumero;
    private String sugestaoParteCliente;
    private String sugestaoParteOposta;

    private Long referenciaHistoricoLancamentoId;
    private LocalDate referenciaHistoricoData;
    private int indicePar;
    private int totalHistoricoChave;
    private int totalPendenteChave;
}
