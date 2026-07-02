package br.com.vilareal.condominio.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Uma linha da planilha (unidade + pessoas + endereço). Reutilizado na extração e na importação (JSON).
 */
public record UnidadePlanilhaLinhaDto(
        @NotBlank String codigoUnidade,
        @NotNull @Valid PlanilhaPessoaDto proprietario,
        @NotNull @Valid PlanilhaPessoaDto inquilino,
        @NotNull @Valid PlanilhaEnderecoDto endereco,
        String situacaoProprietarioCpf,
        String situacaoInquilinoCpf,
        List<PlanilhaPessoaDto> coproprietarios) {

    public UnidadePlanilhaLinhaDto {
        if (coproprietarios == null) {
            coproprietarios = List.of();
        }
    }

    public UnidadePlanilhaLinhaDto(
            String codigoUnidade,
            PlanilhaPessoaDto proprietario,
            PlanilhaPessoaDto inquilino,
            PlanilhaEnderecoDto endereco,
            String situacaoProprietarioCpf,
            String situacaoInquilinoCpf) {
        this(codigoUnidade, proprietario, inquilino, endereco, situacaoProprietarioCpf, situacaoInquilinoCpf, List.of());
    }
}
