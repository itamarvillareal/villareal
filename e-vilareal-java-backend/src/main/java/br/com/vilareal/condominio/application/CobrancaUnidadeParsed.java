package br.com.vilareal.condominio.application;

import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;

import java.util.List;

/** Unidade extraída do relatório .xls de inadimplência (bloco Proprietário + grade de débitos). */
public record CobrancaUnidadeParsed(
        String codigoUnidadeNormalizada,
        String proprietarioNome,
        String proprietarioDocDigitos,
        List<InadimplenciaCobrancaDto> cobrancas) {}
