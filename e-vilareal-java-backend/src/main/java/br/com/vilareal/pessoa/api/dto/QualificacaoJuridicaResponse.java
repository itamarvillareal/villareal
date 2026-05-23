package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Texto de qualificação jurídica da pessoa")
public record QualificacaoJuridicaResponse(
        String qualificacao,
        String qualificacaoHtml
) {
}
