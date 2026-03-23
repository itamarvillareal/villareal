package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.PublicacaoRequest;
import br.com.vilareal.api.dto.PublicacaoResponse;
import br.com.vilareal.api.dto.PublicacaoStatusPatchRequest;
import br.com.vilareal.api.dto.PublicacaoVinculoProcessoPatchRequest;
import br.com.vilareal.api.entity.enums.PublicacaoOrigemImportacao;
import br.com.vilareal.api.entity.enums.PublicacaoStatusTratamento;

import java.time.LocalDate;
import java.util.List;

public interface PublicacaoService {
    List<PublicacaoResponse> listar(
            LocalDate dataInicio,
            LocalDate dataFim,
            PublicacaoStatusTratamento status,
            Long processoId,
            Long clienteId,
            String texto,
            PublicacaoOrigemImportacao origemImportacao
    );

    PublicacaoResponse buscar(Long id);
    PublicacaoResponse criar(PublicacaoRequest request);
    PublicacaoResponse atualizar(Long id, PublicacaoRequest request);
    PublicacaoResponse alterarStatus(Long id, PublicacaoStatusPatchRequest request);
    PublicacaoResponse vincularProcesso(Long id, PublicacaoVinculoProcessoPatchRequest request);
    void excluir(Long id);
}
