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
    /** Referência ao processo no front: `codigoCliente8|numeroInterno` (ex.: 00000001|2). */
    private String processoRef;
    private String origem;
}
