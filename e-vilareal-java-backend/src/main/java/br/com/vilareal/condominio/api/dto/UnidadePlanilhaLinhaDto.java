package br.com.vilareal.condominio.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Uma linha da planilha (unidade + pessoas + endereço). Reutilizado na extração e na importação (JSON).
 */
public record UnidadePlanilhaLinhaDto(
        @NotBlank String codigoUnidade,
        @NotNull @Valid PlanilhaPessoaDto proprietario,
        @NotNull @Valid PlanilhaPessoaDto inquilino,
        @NotNull @Valid PlanilhaEnderecoDto endereco,
        String situacaoProprietarioCpf,
        String situacaoInquilinoCpf) {}
