package br.com.vilareal.condominio.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record UnidadesPessoasImportRequest(
        @NotBlank String clienteCodigo,
        @NotEmpty @Valid List<UnidadePlanilhaLinhaDto> unidades,
        /**
         * Opcional. Se preenchido (ex.: após importação PDF), é o <strong>único</strong> {@code importacaoId} desta
         * sessão — não se gera UUID novo; pessoas, contatos, endereços e partes criadas usam este valor para reversão
         * unificada com {@code DELETE .../reverter/{id}}.
         */
        String importacaoId) {}
