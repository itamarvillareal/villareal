package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.ProcessoAndamentoRequest;
import br.com.vilareal.api.dto.ProcessoAndamentoResponse;

import java.util.List;

public interface ProcessoAndamentoService {
    List<ProcessoAndamentoResponse> listar(Long processoId);

    ProcessoAndamentoResponse criar(Long processoId, ProcessoAndamentoRequest request);

    ProcessoAndamentoResponse atualizar(Long processoId, Long andamentoId, ProcessoAndamentoRequest request);

    void remover(Long processoId, Long andamentoId);
}
