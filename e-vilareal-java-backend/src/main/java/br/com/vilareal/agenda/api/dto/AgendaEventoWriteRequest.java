package br.com.vilareal.agenda.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class AgendaEventoWriteRequest {

    @NotNull(message = "usuarioId é obrigatório.")
    private Long usuarioId;

    @NotNull(message = "dataEvento é obrigatória.")
    private LocalDate dataEvento;

    @Size(max = 16)
    private String horaEvento;

    @Size(max = 2000)
    private String descricao;

    @Size(max = 8)
    private String statusCurto;

    @Size(max = 120)
    private String processoRef;

    @Size(max = 80)
    private String origem;
}
