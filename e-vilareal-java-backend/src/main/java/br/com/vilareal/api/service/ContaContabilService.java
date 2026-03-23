package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.ContaContabilRequest;
import br.com.vilareal.api.dto.ContaContabilResponse;

import java.util.List;

public interface ContaContabilService {
    List<ContaContabilResponse> listar();
    ContaContabilResponse criar(ContaContabilRequest request);
    ContaContabilResponse atualizar(Long id, ContaContabilRequest request);
}
