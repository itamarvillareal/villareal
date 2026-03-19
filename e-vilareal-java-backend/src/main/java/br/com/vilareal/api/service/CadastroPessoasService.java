package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.CadastroPessoasRequest;
import br.com.vilareal.api.dto.CadastroPessoasResponse;

import java.util.List;
import java.util.Optional;

public interface CadastroPessoasService {

    CadastroPessoasResponse criar(CadastroPessoasRequest request);
    CadastroPessoasResponse atualizar(Long id, CadastroPessoasRequest request);
    Optional<CadastroPessoasResponse> buscarPorId(Long id);
    List<CadastroPessoasResponse> listarTodos();
    List<CadastroPessoasResponse> listarAtivos();
    void excluir(Long id);
    boolean existePorId(Long id);
}
