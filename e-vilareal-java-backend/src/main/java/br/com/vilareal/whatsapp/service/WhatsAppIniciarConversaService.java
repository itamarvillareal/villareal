package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.whatsapp.dto.IniciarTelefoneItemDTO;
import br.com.vilareal.whatsapp.dto.IniciarTelefonesResponseDTO;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
public class WhatsAppIniciarConversaService {

    private final ClienteRepository clienteRepository;
    private final PessoaRepository pessoaRepository;
    private final ClienteEnvioTelefoneResolver telefoneResolver;

    public WhatsAppIniciarConversaService(
            ClienteRepository clienteRepository,
            PessoaRepository pessoaRepository,
            ClienteEnvioTelefoneResolver telefoneResolver) {
        this.clienteRepository = clienteRepository;
        this.pessoaRepository = pessoaRepository;
        this.telefoneResolver = telefoneResolver;
    }

    @Transactional(readOnly = true)
    public IniciarTelefonesResponseDTO resolverTelefones(Long pessoaId, Long clienteId) {
        if (pessoaId == null && clienteId == null) {
            throw new IllegalArgumentException("Informe pessoaId ou clienteId");
        }

        ClienteEntity cliente = resolverCliente(pessoaId, clienteId);
        if (cliente == null) {
            Long pid = pessoaId != null ? pessoaId : null;
            String nome = pid != null ? nomePessoa(pid) : null;
            return new IniciarTelefonesResponseDTO(pid, null, nome, List.of());
        }

        PessoaEntity pessoa = cliente.getPessoa();
        Long pid = pessoa != null ? pessoa.getId() : pessoaId;
        String contactName = nomePessoa(pessoa);

        List<IniciarTelefoneItemDTO> telefones = telefoneResolver.resolverTelefonesDetalhados(cliente).stream()
                .map(d -> new IniciarTelefoneItemDTO(d.numeroCanonico(), d.label(), d.principal(), contactName))
                .toList();

        return new IniciarTelefonesResponseDTO(pid, cliente.getId(), contactName, telefones);
    }

    private ClienteEntity resolverCliente(Long pessoaId, Long clienteId) {
        if (clienteId != null) {
            return clienteRepository.findById(clienteId).orElse(null);
        }
        return clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoaId).stream()
                .findFirst()
                .orElse(null);
    }

    private String nomePessoa(Long pessoaId) {
        if (pessoaId == null) {
            return null;
        }
        return pessoaRepository.findById(pessoaId).map(this::nomePessoa).orElse(null);
    }

    private String nomePessoa(PessoaEntity pessoa) {
        if (pessoa == null || !StringUtils.hasText(pessoa.getNome())) {
            return null;
        }
        return Utf8MojibakeUtil.corrigir(pessoa.getNome().trim());
    }
}
