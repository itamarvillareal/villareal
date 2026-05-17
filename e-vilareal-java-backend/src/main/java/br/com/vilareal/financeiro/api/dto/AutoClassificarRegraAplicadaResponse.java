package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class AutoClassificarRegraAplicadaResponse {

    private Long regraId;
    private String descricaoPadrao;
    private String letraDestino;
    private BigDecimal confianca;
    private int lancamentosAfetados;
    private List<AutoClassificarExemploResponse> exemplos = new ArrayList<>();
}
