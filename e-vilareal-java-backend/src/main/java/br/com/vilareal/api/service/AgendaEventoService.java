package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.AgendaEventoRequest;
import br.com.vilareal.api.dto.AgendaEventoResponse;

import java.time.LocalDate;
import java.util.List;

public interface AgendaEventoService {
    List<AgendaEventoResponse> listar(Long usuarioId, LocalDate dataInicio, LocalDate dataFim);
    AgendaEventoResponse criar(AgendaEventoRequest request);
    AgendaEventoResponse atualizar(Long id, AgendaEventoRequest request);
    AgendaEventoResponse alterarStatusCurto(Long id, String statusCurto);
    void excluir(Long id);
}
