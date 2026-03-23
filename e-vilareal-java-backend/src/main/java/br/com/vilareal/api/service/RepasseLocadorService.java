package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.RepasseLocadorRequest;
import br.com.vilareal.api.dto.RepasseLocadorResponse;

import java.util.List;

public interface RepasseLocadorService {
    List<RepasseLocadorResponse> listar(Long contratoId);

    RepasseLocadorResponse criar(RepasseLocadorRequest request);

    RepasseLocadorResponse atualizar(Long id, RepasseLocadorRequest request);
}
