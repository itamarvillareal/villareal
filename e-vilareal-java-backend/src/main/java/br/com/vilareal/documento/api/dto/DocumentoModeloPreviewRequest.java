package br.com.vilareal.documento.api.dto;

import jakarta.validation.constraints.NotBlank;

/** Dados do formulário para pré-visualização de PDF (corpo fixo de demonstração). */
public record DocumentoModeloPreviewRequest(
        @NotBlank String advogadoNome,
        @NotBlank String advogadoOab,
        @NotBlank String rodapeTexto,
        /** Modelo já salvo — reutiliza cabeçalho do banco quando nenhum arquivo novo é enviado. */
        Long modeloId,
        /** Quando true, ignora cabeçalho salvo (preview cai no logo padrão do escritório). */
        Boolean removerCabecalho) {}
