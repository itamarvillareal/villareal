package br.com.vilareal.projudi.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

@Schema(description = "Cancela agendamento de protocolo de várias petições")
public record CancelarAgendamentoLoteRequest(@NotEmpty List<Long> peticaoIds) {}
