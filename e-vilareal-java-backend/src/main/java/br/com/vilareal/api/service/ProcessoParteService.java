package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.ProcessoParteRequest;
import br.com.vilareal.api.dto.ProcessoParteResponse;

import java.util.List;

public interface ProcessoParteService {
    List<ProcessoParteResponse> listar(Long processoId);

    ProcessoParteResponse criar(Long processoId, ProcessoParteRequest request);

    ProcessoParteResponse atualizar(Long processoId, Long parteId, ProcessoParteRequest request);

    void remover(Long processoId, Long parteId);
}
