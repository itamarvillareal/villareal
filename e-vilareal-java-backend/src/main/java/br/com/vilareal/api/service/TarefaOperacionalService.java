package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.TarefaOperacionalRequest;
import br.com.vilareal.api.dto.TarefaOperacionalResponse;
import br.com.vilareal.api.dto.TarefaOperacionalStatusPatchRequest;
import br.com.vilareal.api.entity.enums.TarefaOperacionalPrioridade;
import br.com.vilareal.api.entity.enums.TarefaOperacionalStatus;

import java.time.LocalDate;
import java.util.List;

public interface TarefaOperacionalService {
    List<TarefaOperacionalResponse> listar(
            Long responsavelUsuarioId,
            TarefaOperacionalStatus status,
            TarefaOperacionalPrioridade prioridade,
            Long clienteId,
            Long processoId,
            LocalDate dataLimiteDe,
            LocalDate dataLimiteAte
    );

    TarefaOperacionalResponse buscar(Long id);

    TarefaOperacionalResponse criar(TarefaOperacionalRequest request);

    TarefaOperacionalResponse atualizar(Long id, TarefaOperacionalRequest request);

    TarefaOperacionalResponse alterarStatus(Long id, TarefaOperacionalStatusPatchRequest request);
}
