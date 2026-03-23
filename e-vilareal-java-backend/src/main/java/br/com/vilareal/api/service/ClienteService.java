package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.ClienteRequest;
import br.com.vilareal.api.dto.ClienteResponse;

import java.util.List;

public interface ClienteService {
    List<ClienteResponse> listar();
    ClienteResponse criar(ClienteRequest request);
    ClienteResponse atualizar(Long id, ClienteRequest request);
    ClienteResponse buscarPorId(Long id);
}
