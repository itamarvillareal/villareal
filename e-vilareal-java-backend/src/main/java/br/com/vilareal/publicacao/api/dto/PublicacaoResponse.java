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
    @io.swagger.v3.oas.annotations.media.Schema(description = "PK da tabela cliente")
    private Long clienteId;
    @io.swagger.v3.oas.annotations.media.Schema(description = "pessoa.id titular do processo vinculado")
    private Long pessoaRefId;
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
    /** Data/hora em que o email Jusbrasil chegou na caixa Gmail. */
    private Instant emailRecebidoEm;
    /** Ordem na caixa Gmail (0 = topo); fiel à inbox Projudi+TRT. */
    private Integer gmailCaixaOrdem;
    private String jsonReferencia;
    private String statusTratamento;
    private boolean lida;
    private String observacao;

    private boolean andamentosNoDrive;
    private String driveFolderUrl;
    private java.time.LocalDateTime andamentosNoDriveEm;
    private Integer qtdArquivosDrive;

    /**
     * Nome do titular do processo ({@code processo.pessoa}), quando {@link #processoId} preenchido.
     * Preferir este campo para rótulos de vínculo; {@link #parteCliente} repete o mesmo valor por compatibilidade.
     */
    private String titularNome;

    /** REQUERENTE ou REQUERIDO — define qual polo é «parte cliente» do escritório. */
    private String papelCliente;

    /** Parte(s) do lado do escritório ({@code processo_parte} + {@link #papelCliente}). */
    private String parteCliente;

    /** Parte(s) oposta(s) agregada(s), critério alinhado a {@code ProcessoResponse#getParteOposta()}. */
    private String parteOposta;
}
