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
    /** true quando o resumo agrega compromissos de todos os usuários (visão Geral). */
    private boolean todosUsuarios;
    private List<DiaAgendaMensalDto> diasComEventos;
}
