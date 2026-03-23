package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.PessoaDadosComplementaresRequest;
import br.com.vilareal.api.dto.PessoaDadosComplementaresResponse;

public interface PessoaDadosComplementaresService {
    PessoaDadosComplementaresResponse obter(Long pessoaId);
    PessoaDadosComplementaresResponse salvar(Long pessoaId, PessoaDadosComplementaresRequest request);
}
