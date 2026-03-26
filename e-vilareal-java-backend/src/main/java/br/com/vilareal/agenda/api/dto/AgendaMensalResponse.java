package br.com.vilareal.agenda.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class AgendaMensalResponse {

    private int ano;
    private int mes;
    private Long usuarioId;
    private List<DiaAgendaMensalDto> diasComEventos;
}
