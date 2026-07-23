package br.com.vilareal.projudi.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;

@Schema(description = "Agendar protocolo para várias petições no mesmo horário")
public record AgendarProtocoloLoteRequest(
        @NotEmpty List<Long> peticaoIds,
        @NotNull Instant agendadoPara,
        @Schema(description = "Marca «Envolve pedido de urgência» na confirmação PROJUDI") Boolean pedidoUrgencia,
        @Schema(description = "Marca «Pedido de Liberdade» na confirmação PROJUDI") Boolean pedidoLiberdade) {}
