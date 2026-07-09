package br.com.vilareal.agenda.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class AgendaLoteResumoResponse {

    private String loteRef;
    private String textoBase;
    private LocalDate primeiraData;
    private LocalDate ultimaData;
    private int qtdLinhas;
    private int qtdEventos;
    private List<Long> usuarioIds = new ArrayList<>();
}
