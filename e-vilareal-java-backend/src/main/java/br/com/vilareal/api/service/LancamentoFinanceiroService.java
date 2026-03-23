package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.LancamentoFinanceiroRequest;
import br.com.vilareal.api.dto.LancamentoFinanceiroResponse;
import br.com.vilareal.api.dto.ResumoContaCorrenteProcessoResponse;

import java.time.LocalDate;
import java.util.List;

public interface LancamentoFinanceiroService {
    List<LancamentoFinanceiroResponse> listar(Long clienteId, Long processoId, Long contaContabilId, LocalDate dataInicio, LocalDate dataFim);
    LancamentoFinanceiroResponse buscar(Long id);
    LancamentoFinanceiroResponse criar(LancamentoFinanceiroRequest request);
    LancamentoFinanceiroResponse atualizar(Long id, LancamentoFinanceiroRequest request);
    void excluir(Long id);
    ResumoContaCorrenteProcessoResponse resumirContaCorrenteProcesso(Long processoId);
}
