package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class RecorrenciaDetectadaResponse {

    private String descricaoNorm;
    private String descricaoExemplo;
    private Integer numeroBanco;
    private String bancoNome;
    private BigDecimal valorTipico;
    private Long contaContabilId;
    private String contaCodigo;
    private String contaNome;
    private Long clienteId;
    private String clienteNome;
    private Long processoId;
    private String processoNumero;
    private long ocorrenciasHistorico;
    private long mesesCobertos;
    private double consistenciaConta;
    private Double consistenciaVinculo;
    private ConfiancaSugestao confianca;
    private long qtdPendentes;
}
