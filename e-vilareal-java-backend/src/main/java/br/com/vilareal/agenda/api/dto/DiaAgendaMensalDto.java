package br.com.vilareal.agenda.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class DiaAgendaMensalDto {

    private String dataBr;
    private List<AgendaEventoLinhaDto> eventos;
}
