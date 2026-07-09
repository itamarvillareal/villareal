package br.com.vilareal.agenda.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AgendaLoteEventoDto {

    private Long id;
    private Long usuarioId;
    private String dataBr;
    private String hora;
    private String descricao;
}
