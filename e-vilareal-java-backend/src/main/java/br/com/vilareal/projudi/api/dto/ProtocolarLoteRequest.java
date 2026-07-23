package br.com.vilareal.projudi.api.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ProtocolarLoteRequest(
        @NotEmpty List<Long> peticaoIds,
        @NotNull Boolean confirmar,
        /** Texto enviado ao PROJUDI em {@code MovimentacaoComplemento} (Descrição Movimentação). */
        String complemento,
        /** Marca «Envolve pedido de urgência» na confirmação PROJUDI (PaginaAtual=5). */
        Boolean pedidoUrgencia,
        /** Marca «Pedido de Liberdade» na confirmação PROJUDI (PaginaAtual=5). */
        Boolean pedidoLiberdade) {}
