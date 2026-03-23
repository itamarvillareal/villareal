package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.DespesaLocacaoRequest;
import br.com.vilareal.api.dto.DespesaLocacaoResponse;

import java.util.List;

public interface DespesaLocacaoService {
    List<DespesaLocacaoResponse> listar(Long contratoId);

    DespesaLocacaoResponse criar(DespesaLocacaoRequest request);

    DespesaLocacaoResponse atualizar(Long id, DespesaLocacaoRequest request);
}
