package br.com.vilareal.agenda.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class AgendaLoteDetalheResponse {

    private String loteRef;
    private String textoBase;
    private String horaPadrao;
    private String processoRef;
    private List<Long> usuarioIds = new ArrayList<>();
    private List<AgendaLoteLinhaDto> linhas = new ArrayList<>();
    private List<AgendaLoteEventoDto> eventos = new ArrayList<>();
}
