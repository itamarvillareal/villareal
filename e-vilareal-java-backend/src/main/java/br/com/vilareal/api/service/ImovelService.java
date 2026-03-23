package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.ImovelRequest;
import br.com.vilareal.api.dto.ImovelResponse;

import java.util.List;

public interface ImovelService {
    List<ImovelResponse> listar(Long clienteId);

    ImovelResponse buscar(Long id);

    ImovelResponse criar(ImovelRequest request);

    ImovelResponse atualizar(Long id, ImovelRequest request);
}
