package br.com.vilareal.pessoa.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
public class ClienteResolverService {

    private final ClienteRepository clienteRepository;
    private final PessoaRepository pessoaRepository;

    public ClienteResolverService(ClienteRepository clienteRepository, PessoaRepository pessoaRepository) {
        this.clienteRepository = clienteRepository;
        this.pessoaRepository = pessoaRepository;
    }

    /**
     * Resolve pessoa do titular → registro em {@code cliente}.
     * Prioridade: {@code cliente.pessoa_id}; fallback {@code codigo_cliente = LPAD(pessoaId, 8)}.
     */
    @Transactional(readOnly = true)
    public ClienteEntity resolverClienteParaTitular(Long pessoaIdTitular) {
        if (pessoaIdTitular == null) {
            throw new ResourceNotFoundException("pessoaId do titular é obrigatório para resolver cliente.");
        }
        List<ClienteEntity> porPessoa = clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoaIdTitular);
        if (!porPessoa.isEmpty()) {
            return porPessoa.get(0);
        }
        String codigoLegado = codigoClienteLpad(pessoaIdTitular);
        return clienteRepository
                .findByCodigoClienteFetchPessoa(codigoLegado)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cliente não encontrado para titular pessoaId=" + pessoaIdTitular
                                + " (direto nem LPAD " + codigoLegado + ")."));
    }

    @Transactional(readOnly = true)
    public ClienteEntity resolverClientePorCodigo(String codigoCliente) {
        if (!StringUtils.hasText(codigoCliente)) {
            throw new ResourceNotFoundException("Código de cliente é obrigatório.");
        }
        String cod = codigoCliente.trim();
        return clienteRepository
                .findByCodigoClienteFetchPessoaTrim(cod)
                .or(() -> clienteRepository.findByCodigoClienteFetchPessoa(cod))
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado para código: " + cod));
    }

    @Transactional(readOnly = true)
    public ClienteEntity buscarPorId(Long clienteId) {
        if (clienteId == null) {
            throw new ResourceNotFoundException("clienteId é obrigatório.");
        }
        return clienteRepository
                .findById(clienteId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + clienteId));
    }

    @Transactional(readOnly = true)
    public VinculoClientePessoa resolverVinculoPorPessoaId(Long pessoaId) {
        PessoaEntity pessoa = pessoaRepository
                .findById(pessoaId)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId));
        ClienteEntity cliente = resolverClienteParaTitular(pessoaId);
        return new VinculoClientePessoa(cliente, pessoa);
    }

    @Transactional(readOnly = true)
    public VinculoClientePessoa resolverVinculoOpcional(Long clienteIdFromRequest, ProcessoEntity processo) {
        ClienteEntity clienteEntidade = null;
        if (clienteIdFromRequest != null) {
            clienteEntidade = buscarPorId(clienteIdFromRequest);
        }
        if (processo != null) {
            if (clienteEntidade != null && processo.getCliente() != null
                    && !processo.getCliente().getId().equals(clienteEntidade.getId())) {
                throw new BusinessRuleException("O processo informado não pertence ao cliente indicado.");
            }
            if (clienteEntidade == null) {
                clienteEntidade =
                        processo.getCliente() != null
                                ? processo.getCliente()
                                : resolverClienteParaTitular(processo.getPessoa().getId());
            }
        }
        PessoaEntity titular =
                processo != null && processo.getPessoa() != null ? processo.getPessoa() : null;
        return new VinculoClientePessoa(clienteEntidade, titular);
    }

    public static String codigoClienteLpad(long pessoaId) {
        return String.format("%08d", pessoaId);
    }

    public record VinculoClientePessoa(ClienteEntity clienteEntidade, PessoaEntity pessoaRef) {}
}
