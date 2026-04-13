package br.com.vilareal.condominio.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record InadimplenciaCobrancaDto(
        String receita,
        String doc,
        String periodo,
        String vencimento,
        String valor,
        long valorCentavos,
        String multa) {}
