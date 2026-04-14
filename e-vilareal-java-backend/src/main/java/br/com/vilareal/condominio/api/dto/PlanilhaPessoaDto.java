package br.com.vilareal.condominio.api.dto;

import java.util.List;

/**
 * Dados de pessoa extraídos da planilha de unidades (proprietário ou inquilino).
 */
public record PlanilhaPessoaDto(
        String nome,
        String cpfCnpjBruto,
        String cpfCnpjNormalizado,
        String rg,
        List<String> emails,
        List<String> telefones) {}
