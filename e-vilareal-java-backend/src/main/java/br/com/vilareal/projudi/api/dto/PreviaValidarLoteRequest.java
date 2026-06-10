package br.com.vilareal.projudi.api.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record PreviaValidarLoteRequest(@NotEmpty List<Long> peticaoIds) {}
