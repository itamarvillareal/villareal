package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.PermissaoRequest;
import br.com.vilareal.api.dto.PermissaoResponse;

import java.util.List;

public interface PermissaoService {
    List<PermissaoResponse> listar();
    PermissaoResponse criar(PermissaoRequest request);
}
