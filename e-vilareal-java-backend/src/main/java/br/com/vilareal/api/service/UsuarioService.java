package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.UsuarioRequest;
import br.com.vilareal.api.dto.UsuarioResponse;

import java.util.List;

public interface UsuarioService {
    List<UsuarioResponse> listar();
    UsuarioResponse criar(UsuarioRequest request);
    UsuarioResponse atualizar(Long id, UsuarioRequest request);
    UsuarioResponse alterarAtivo(Long id, boolean ativo);
    UsuarioResponse definirPerfis(Long id, List<Long> perfilIds);
}
