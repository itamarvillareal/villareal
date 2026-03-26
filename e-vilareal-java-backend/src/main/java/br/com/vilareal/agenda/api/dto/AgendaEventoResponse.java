package br.com.vilareal.agenda.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class AgendaEventoResponse {

    private Long id;
    private Long usuarioId;
    private String usuarioNome;
    private LocalDate dataEvento;
    private String horaEvento;
    private String descricao;
    private String statusCurto;
    private String origem;
}
