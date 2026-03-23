package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.PerfilRequest;
import br.com.vilareal.api.dto.PerfilResponse;

import java.util.List;

public interface PerfilService {
    List<PerfilResponse> listar();
    PerfilResponse criar(PerfilRequest request);
    PerfilResponse atualizar(Long id, PerfilRequest request);
    PerfilResponse definirPermissoes(Long id, List<Long> permissaoIds);
}
