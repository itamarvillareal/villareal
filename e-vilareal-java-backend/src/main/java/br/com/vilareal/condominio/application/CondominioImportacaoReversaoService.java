package br.com.vilareal.condominio.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.condominio.api.dto.InadimplenciaReversaoResponse;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaEnderecoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoAndamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CondominioImportacaoReversaoService {

    private final CalculoRodadaRepository calculoRodadaRepository;
    private final ProcessoAndamentoRepository processoAndamentoRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final ProcessoRepository processoRepository;
    private final PessoaContatoRepository pessoaContatoRepository;
    private final PessoaEnderecoRepository pessoaEnderecoRepository;
    private final PessoaRepository pessoaRepository;

    public CondominioImportacaoReversaoService(
            CalculoRodadaRepository calculoRodadaRepository,
            ProcessoAndamentoRepository processoAndamentoRepository,
            ProcessoParteRepository processoParteRepository,
            ProcessoRepository processoRepository,
            PessoaContatoRepository pessoaContatoRepository,
            PessoaEnderecoRepository pessoaEnderecoRepository,
            PessoaRepository pessoaRepository) {
        this.calculoRodadaRepository = calculoRodadaRepository;
        this.processoAndamentoRepository = processoAndamentoRepository;
        this.processoParteRepository = processoParteRepository;
        this.processoRepository = processoRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
        this.pessoaEnderecoRepository = pessoaEnderecoRepository;
        this.pessoaRepository = pessoaRepository;
    }

    @Transactional
    public InadimplenciaReversaoResponse reverter(String importacaoIdRaw) {
        if (!StringUtils.hasText(importacaoIdRaw)) {
            throw new BusinessRuleException("importacaoId é obrigatório.");
        }
        String importacaoId = importacaoIdRaw.trim();
        long total =
                processoAndamentoRepository.countByImportacaoId(importacaoId)
                        + calculoRodadaRepository.countByImportacaoId(importacaoId)
                        + processoParteRepository.countByImportacaoId(importacaoId)
                        + processoRepository.countByImportacaoId(importacaoId)
                        + pessoaContatoRepository.countByImportacaoId(importacaoId)
                        + pessoaEnderecoRepository.countByImportacaoId(importacaoId)
                        + pessoaRepository.countByImportacaoId(importacaoId);
        if (total == 0) {
            throw new ResourceNotFoundException("Importação não encontrada ou já revertida");
        }

        long andamentosRemovidos = processoAndamentoRepository.deleteByImportacaoId(importacaoId);
        long calculosRemovidos = calculoRodadaRepository.deleteByImportacaoId(importacaoId);
        long partesRemovidas = processoParteRepository.deleteByImportacaoId(importacaoId);
        long processosRemovidos = processoRepository.deleteByImportacaoId(importacaoId);
        long contatosRemovidos = pessoaContatoRepository.deleteByImportacaoId(importacaoId);
        long enderecosRemovidos = pessoaEnderecoRepository.deleteByImportacaoId(importacaoId);
        long pessoasRemovidas = pessoaRepository.deleteByImportacaoId(importacaoId);

        return new InadimplenciaReversaoResponse(
                importacaoId,
                andamentosRemovidos,
                calculosRemovidos,
                partesRemovidas,
                processosRemovidos,
                contatosRemovidos,
                enderecosRemovidos,
                pessoasRemovidas);
    }
}
