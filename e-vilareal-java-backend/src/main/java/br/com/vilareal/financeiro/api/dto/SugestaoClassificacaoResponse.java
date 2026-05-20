package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.OrigemSugestao;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SugestaoClassificacaoResponse {

    private Long contaContabilId;
    private String contaCodigo;
    private String contaNome;
    private ConfiancaSugestao confianca;
    private OrigemSugestao origem;
    private Long regraId;
    private String descricaoRegra;
    private Long ocorrencias;
    private Long clienteId;
    private Long processoId;
    /** Pessoa do cadastro identificada na descrição (pagador), quando distinta do titular do processo. */
    private Long pagadorPessoaId;
    /** Texto para escolha entre vários pares cliente/proc (ex.: «00000728 · proc 12»). */
    private String rotuloVinculo;
}
