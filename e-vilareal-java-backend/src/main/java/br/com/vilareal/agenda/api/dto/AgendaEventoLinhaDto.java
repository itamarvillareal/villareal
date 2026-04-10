package br.com.vilareal.agenda.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AgendaEventoLinhaDto {

    private String id;
    private String hora;
    private String descricao;
    private String statusCurto;
    /** Mesmo formato do GET de eventos: cliente×processo interno. */
    private String processoRef;
    /** Preenchido na visão «todos os usuários» (modal agenda mensal). */
    private String usuarioNome;
}
