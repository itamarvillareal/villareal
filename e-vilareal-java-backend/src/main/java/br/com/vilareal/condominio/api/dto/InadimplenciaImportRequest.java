package br.com.vilareal.condominio.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record InadimplenciaImportRequest(
        @NotBlank String clienteCodigo,
        @NotNull List<InadimplenciaUnidadeDto> unidades,
        /**
         * Se {@code true} (ou omitido), a pessoa autora coincide com a pessoa do cliente: cria-se parte AUTOR e o
         * cabeçalho do cálculo recebe o nome. Se {@code false}, o processo fica sem parte autora (cadastro manual
         * depois) e o campo autor do cálculo permanece vazio.
         */
        Boolean autorMesmaPessoaCliente) {}
