package br.com.vilareal.projudi.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

@Schema(description = "Agendar protocolo PROJUDI para horário fixo")
public record AgendarProtocoloRequest(
        @NotNull @Schema(description = "Instante UTC em que o protocolo deve ser disparado (petição ASSINADA)")
                Instant agendadoPara,
        @Schema(description = "Marca «Envolve pedido de urgência» na confirmação PROJUDI") Boolean pedidoUrgencia,
        @Schema(description = "Marca «Pedido de Liberdade» na confirmação PROJUDI") Boolean pedidoLiberdade) {}
