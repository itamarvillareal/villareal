package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.ContratoLocacaoRequest;
import br.com.vilareal.api.dto.ContratoLocacaoResponse;

import java.util.List;

public interface ContratoLocacaoService {
    List<ContratoLocacaoResponse> listar(Long imovelId, Long clienteId);

    ContratoLocacaoResponse buscar(Long id);

    ContratoLocacaoResponse criar(ContratoLocacaoRequest request);

    ContratoLocacaoResponse atualizar(Long id, ContratoLocacaoRequest request);
}
