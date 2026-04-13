package br.com.vilareal.condominio.api.dto;

import java.util.List;

public record InadimplenciaUnidadeDto(String codigoUnidade, List<InadimplenciaCobrancaDto> cobrancas) {}
