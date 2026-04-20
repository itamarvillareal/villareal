package br.com.vilareal.publicacao.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Getter
@Setter
public class PublicacaoResponse {

    private Long id;
    private Instant createdAt;
    private String numeroProcessoEncontrado;
    private Long processoId;
    /** Quando {@link #processoId} preenchido: código de cliente (8 dígitos ou chave planilha) do processo vinculado. */
    private String codigoClienteProcesso;
    /** Quando {@link #processoId} preenchido: nº interno do processo na pasta do cliente. */
    private Integer numeroInternoProcesso;
    private Long clienteId;
    private LocalDate dataDisponibilizacao;
    private LocalDate dataPublicacao;
    private String fonte;
    private String diario;
    private String titulo;
    private String tipoPublicacao;
    private String resumo;
    private String teor;
    private String statusValidacaoCnj;
    private String scoreConfianca;
    private String hashTeor;
    private String hashConteudo;
    private String origemImportacao;
    private String arquivoOrigemNome;
    private String arquivoOrigemHash;
    private String jsonReferencia;
    private String statusTratamento;
    private boolean lida;
    private String observacao;
}
