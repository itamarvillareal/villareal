package br.com.vilareal.condominio.api.dto;

import java.util.List;

public record CobrancaProcessarResponse(
        String importacaoId, List<CobrancaProcessarItemDto> itens, List<CobrancaProcessarErroDto> erros) {}
