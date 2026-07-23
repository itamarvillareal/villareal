package br.com.vilareal.projudi.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ProtocolarProcessoRequest(
        @NotBlank String numeroProcesso,
        @NotNull Boolean confirmar,
        /** Texto enviado ao PROJUDI em {@code MovimentacaoComplemento} (Descrição Movimentação). */
        String complemento,
        Boolean pedidoUrgencia,
        Boolean pedidoLiberdade) {}
