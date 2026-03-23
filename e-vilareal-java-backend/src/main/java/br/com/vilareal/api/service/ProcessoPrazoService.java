package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.ProcessoPrazoRequest;
import br.com.vilareal.api.dto.ProcessoPrazoResponse;

import java.util.List;

public interface ProcessoPrazoService {
    List<ProcessoPrazoResponse> listar(Long processoId);

    ProcessoPrazoResponse criar(Long processoId, ProcessoPrazoRequest request);

    ProcessoPrazoResponse atualizar(Long processoId, Long prazoId, ProcessoPrazoRequest request);

    ProcessoPrazoResponse alterarCumprimento(Long processoId, Long prazoId, boolean cumprido);

    void remover(Long processoId, Long prazoId);
}
