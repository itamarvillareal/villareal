package br.com.vilareal.whatsapp.service;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteWhatsAppEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Resolve todos os telefones de envio WhatsApp de um cliente (sem duplicatas).
 *
 * <p>Prioridade: números ativos em {@code cliente_whatsapp}; se vazio, contatos da pessoa tipo
 * {@code telefone} + campo legado {@code pessoa.telefone}.
 */
@Service
public class ClienteEnvioTelefoneResolver {

    private final ClienteWhatsAppRepository clienteWhatsAppRepository;
    private final PessoaContatoRepository pessoaContatoRepository;

    public ClienteEnvioTelefoneResolver(
            ClienteWhatsAppRepository clienteWhatsAppRepository,
            PessoaContatoRepository pessoaContatoRepository) {
        this.clienteWhatsAppRepository = clienteWhatsAppRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
    }

    public List<String> resolverTelefonesCliente(ClienteEntity cliente) {
        if (cliente == null) {
            return List.of();
        }

        Set<String> numeros = new LinkedHashSet<>();
        List<ClienteWhatsAppEntity> whatsappCadastro =
                clienteWhatsAppRepository.findByCliente_IdAndAtivoTrueOrderByPrincipalDescIdAsc(cliente.getId());
        for (ClienteWhatsAppEntity w : whatsappCadastro) {
            adicionarSeValido(numeros, w.getNumero());
        }

        if (!numeros.isEmpty()) {
            return List.copyOf(numeros);
        }

        PessoaEntity pessoa = cliente.getPessoa();
        if (pessoa != null) {
            List<PessoaContatoEntity> contatos =
                    pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(pessoa.getId());
            for (PessoaContatoEntity c : contatos) {
                if (c.getTipo() != null
                        && "telefone".equalsIgnoreCase(c.getTipo().trim())) {
                    adicionarSeValido(numeros, c.getValor());
                }
            }
            adicionarSeValido(numeros, pessoa.getTelefone());
        }

        return new ArrayList<>(numeros);
    }

    private static void adicionarSeValido(Set<String> destino, String raw) {
        if (!StringUtils.hasText(raw)) {
            return;
        }
        try {
            destino.add(WhatsAppService.formatPhoneNumber(raw.trim()));
        } catch (IllegalArgumentException ignored) {
            // ignora número inválido
        }
    }
}
