package br.com.vilareal.pessoa.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.common.util.TelefoneBrasilUtil;
import br.com.vilareal.pessoa.api.dto.ClienteWhatsAppItemRequest;
import br.com.vilareal.pessoa.api.dto.ClienteWhatsAppItemResponse;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteWhatsAppEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ClienteWhatsAppApplicationService {

    private final ClienteRepository clienteRepository;
    private final ClienteWhatsAppRepository clienteWhatsAppRepository;
    private final PessoaRepository pessoaRepository;
    private final PessoaContatoRepository pessoaContatoRepository;

    public ClienteWhatsAppApplicationService(
            ClienteRepository clienteRepository,
            ClienteWhatsAppRepository clienteWhatsAppRepository,
            PessoaRepository pessoaRepository,
            PessoaContatoRepository pessoaContatoRepository) {
        this.clienteRepository = clienteRepository;
        this.clienteWhatsAppRepository = clienteWhatsAppRepository;
        this.pessoaRepository = pessoaRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
    }

    @Transactional(readOnly = true)
    public List<ClienteWhatsAppItemResponse> listar(Long clienteId) {
        garantirClienteExiste(clienteId);
        return clienteWhatsAppRepository.findByCliente_IdOrderByPrincipalDescIdAsc(clienteId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<ClienteWhatsAppItemResponse> substituir(Long clienteId, List<ClienteWhatsAppItemRequest> itens) {
        ClienteEntity cliente = clienteRepository
                .findById(clienteId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + clienteId));

        clienteWhatsAppRepository.deleteByCliente_Id(clienteId);

        List<ClienteWhatsAppItemRequest> lista = itens != null ? itens : List.of();
        boolean temPrincipal = false;
        Set<String> numerosVistos = new HashSet<>();

        for (ClienteWhatsAppItemRequest req : lista) {
            if (req == null || !StringUtils.hasText(req.getNumero())) {
                continue;
            }
            String numero = TelefoneBrasilUtil.normalizarParaArmazenamento(req.getNumero())
                    .orElseThrow(() -> new BusinessRuleException(
                            "Número WhatsApp inválido: " + req.getNumero()));
            if (!numerosVistos.add(numero)) {
                continue;
            }

            ClienteWhatsAppEntity e = new ClienteWhatsAppEntity();
            e.setCliente(cliente);
            e.setNumero(numero);
            e.setNomeLabel(Utf8MojibakeUtil.corrigir(req.getNomeLabel()));
            boolean principal = Boolean.TRUE.equals(req.getPrincipal());
            e.setPrincipal(principal);
            if (principal) {
                temPrincipal = true;
            }
            e.setPreenchidoAutomaticamente(Boolean.TRUE.equals(req.getPreenchidoAutomaticamente()));
            e.setAtivo(req.getAtivo() == null || Boolean.TRUE.equals(req.getAtivo()));

            if (req.getPessoaId() != null) {
                PessoaEntity pessoa = pessoaRepository
                        .findById(req.getPessoaId())
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Pessoa não encontrada: " + req.getPessoaId()));
                e.setPessoa(pessoa);
            }
            if (req.getPessoaContatoId() != null) {
                PessoaContatoEntity contato = pessoaContatoRepository
                        .findById(req.getPessoaContatoId())
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Contato não encontrado: " + req.getPessoaContatoId()));
                e.setPessoaContato(contato);
            }

            clienteWhatsAppRepository.save(e);
        }

        if (!temPrincipal) {
            marcarPrimeiroComoPrincipal(clienteId);
        }

        return listar(clienteId);
    }

    /**
     * Copia telefones da pessoa vinculada para {@code cliente_whatsapp}, sem alterar {@code pessoa_contato}.
     * Números já cadastrados para o cliente são ignorados.
     */
    @Transactional
    public List<ClienteWhatsAppItemResponse> importarTelefonesDaPessoa(Long clienteId, Long pessoaId) {
        ClienteEntity cliente = clienteRepository
                .findById(clienteId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + clienteId));
        if (!pessoaRepository.existsById(pessoaId)) {
            throw new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId);
        }

        List<ClienteWhatsAppEntity> existentes =
                clienteWhatsAppRepository.findByCliente_IdOrderByPrincipalDescIdAsc(clienteId);
        boolean temPrincipal = existentes.stream().anyMatch(e -> Boolean.TRUE.equals(e.getPrincipal()));

        List<PessoaContatoEntity> contatos = pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(pessoaId);
        List<ClienteWhatsAppEntity> adicionados = new ArrayList<>();

        for (PessoaContatoEntity c : contatos) {
            if (c.getTipo() == null || !"telefone".equalsIgnoreCase(c.getTipo().trim())) {
                continue;
            }
            if (!StringUtils.hasText(c.getValor())) {
                continue;
            }
            String numero = TelefoneBrasilUtil.normalizarParaArmazenamento(c.getValor()).orElse(null);
            if (numero == null) {
                continue;
            }
            if (jaExisteNumero(existentes, numero) || jaExisteNumero(adicionados, numero)) {
                continue;
            }

            ClienteWhatsAppEntity e = new ClienteWhatsAppEntity();
            e.setCliente(cliente);
            e.setPessoa(c.getPessoa());
            e.setPessoaContato(c);
            e.setNumero(numero);
            e.setNomeLabel("WhatsApp — " + (c.getPessoa() != null && StringUtils.hasText(c.getPessoa().getNome())
                    ? Utf8MojibakeUtil.corrigir(c.getPessoa().getNome())
                    : "Pessoa"));
            e.setPreenchidoAutomaticamente(true);
            e.setAtivo(true);
            if (!temPrincipal && adicionados.isEmpty() && existentes.isEmpty()) {
                e.setPrincipal(true);
                temPrincipal = true;
            } else {
                e.setPrincipal(false);
            }

            adicionados.add(clienteWhatsAppRepository.save(e));
            existentes = clienteWhatsAppRepository.findByCliente_IdOrderByPrincipalDescIdAsc(clienteId);
        }

        PessoaEntity pessoa = pessoaRepository.findById(pessoaId).orElse(null);
        if (pessoa != null && StringUtils.hasText(pessoa.getTelefone())) {
            String numeroLegado = TelefoneBrasilUtil.normalizarParaArmazenamento(pessoa.getTelefone())
                    .orElse(null);
            if (numeroLegado != null
                    && !jaExisteNumero(existentes, numeroLegado)
                    && !jaExisteNumero(adicionados, numeroLegado)) {
                ClienteWhatsAppEntity e = new ClienteWhatsAppEntity();
                e.setCliente(cliente);
                e.setPessoa(pessoa);
                e.setNumero(numeroLegado);
                e.setNomeLabel("WhatsApp — " + Utf8MojibakeUtil.corrigir(pessoa.getNome()));
                e.setPreenchidoAutomaticamente(true);
                e.setAtivo(true);
                e.setPrincipal(!temPrincipal && existentes.isEmpty() && adicionados.isEmpty());
                if (Boolean.TRUE.equals(e.getPrincipal())) {
                    temPrincipal = true;
                }
                clienteWhatsAppRepository.save(e);
            }
        }

        if (!temPrincipal) {
            marcarPrimeiroComoPrincipal(clienteId);
        }

        return listar(clienteId);
    }

    private void marcarPrimeiroComoPrincipal(Long clienteId) {
        List<ClienteWhatsAppEntity> lista =
                clienteWhatsAppRepository.findByCliente_IdAndAtivoTrueOrderByPrincipalDescIdAsc(clienteId);
        if (lista.isEmpty()) {
            return;
        }
        ClienteWhatsAppEntity primeiro = lista.getFirst();
        if (!Boolean.TRUE.equals(primeiro.getPrincipal())) {
            primeiro.setPrincipal(true);
            clienteWhatsAppRepository.save(primeiro);
        }
    }

    private static boolean jaExisteNumero(List<ClienteWhatsAppEntity> lista, String numero) {
        for (ClienteWhatsAppEntity e : lista) {
            if (TelefoneBrasilUtil.numerosEquivalentes(e.getNumero(), numero)) {
                return true;
            }
        }
        return false;
    }

    private void garantirClienteExiste(Long clienteId) {
        if (!clienteRepository.existsById(clienteId)) {
            throw new ResourceNotFoundException("Cliente não encontrado: " + clienteId);
        }
    }

    private ClienteWhatsAppItemResponse toResponse(ClienteWhatsAppEntity e) {
        ClienteWhatsAppItemResponse r = new ClienteWhatsAppItemResponse();
        r.setId(e.getId());
        r.setClienteId(e.getCliente() != null ? e.getCliente().getId() : null);
        r.setPessoaId(e.getPessoa() != null ? e.getPessoa().getId() : null);
        r.setPessoaContatoId(e.getPessoaContato() != null ? e.getPessoaContato().getId() : null);
        r.setNumero(e.getNumero());
        r.setNomeLabel(e.getNomeLabel());
        r.setPrincipal(Boolean.TRUE.equals(e.getPrincipal()));
        r.setPreenchidoAutomaticamente(Boolean.TRUE.equals(e.getPreenchidoAutomaticamente()));
        r.setAtivo(Boolean.TRUE.equals(e.getAtivo()));
        r.setCreatedAt(e.getCreatedAt());
        r.setUpdatedAt(e.getUpdatedAt());
        return r;
    }
}
