package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.ProcessoRequest;
import br.com.vilareal.api.dto.ProcessoResponse;

import java.util.List;

public interface ProcessoService {
    List<ProcessoResponse> listar(Long clienteId, String codigoCliente, Boolean ativo);

    ProcessoResponse buscar(Long id);

    ProcessoResponse criar(ProcessoRequest request);

    ProcessoResponse atualizar(Long id, ProcessoRequest request);

    ProcessoResponse alterarAtivo(Long id, boolean ativo);
}
