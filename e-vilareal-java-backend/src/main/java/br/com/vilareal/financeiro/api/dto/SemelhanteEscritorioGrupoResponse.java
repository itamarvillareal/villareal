package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class SemelhanteEscritorioGrupoResponse {

    private String descricaoNorm;
    private String descricaoExemplo;
    private Integer numeroBanco;
    private String bancoNome;
    private BigDecimal valor;
    private int qtdPendentes;
    private int qtdHistorico;
    private String origem;
    private String confianca;
    private List<SemelhanteEscritorioItemResponse> itens = new ArrayList<>();
}
