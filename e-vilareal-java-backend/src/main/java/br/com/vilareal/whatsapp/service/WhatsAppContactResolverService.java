package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Optional;

/**
 * Resolve nome de exibição para conversas WhatsApp: prioriza cadastro (pessoa/cliente) e usa o perfil
 * informado pela Meta quando não houver vínculo no sistema.
 */
@Service
public class WhatsAppContactResolverService {

    private static final String PREFIXO_LABEL_WHATSAPP = "WhatsApp — ";

    private final ClienteRepository clienteRepository;
    private final ClienteWhatsAppRepository clienteWhatsAppRepository;
    private final PessoaContatoRepository pessoaContatoRepository;

    public WhatsAppContactResolverService(
            ClienteRepository clienteRepository,
            ClienteWhatsAppRepository clienteWhatsAppRepository,
            PessoaContatoRepository pessoaContatoRepository) {
        this.clienteRepository = clienteRepository;
        this.clienteWhatsAppRepository = clienteWhatsAppRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
    }

    @Transactional(readOnly = true)
    public String resolveContactName(String phoneNumber, String whatsAppProfileName) {
        return resolveContactName(phoneNumber, whatsAppProfileName, null);
    }

    @Transactional(readOnly = true)
    public String resolveContactName(String phoneNumber, String whatsAppProfileName, Long clienteId) {
        String cadastro = lookupNomeCadastro(phoneNumber, clienteId);
        if (StringUtils.hasText(cadastro)) {
            return cadastro;
        }
        if (StringUtils.hasText(whatsAppProfileName)) {
            return whatsAppProfileName.trim();
        }
        return null;
    }

    private String lookupNomeCadastro(String phoneNumber, Long clienteId) {
        if (clienteId != null) {
            String nome = nomeCliente(clienteRepository.findById(clienteId).orElse(null));
            if (StringUtils.hasText(nome)) {
                return nome;
            }
        }

        String digits = normalizarDigitos(phoneNumber);
        if (digits == null) {
            return null;
        }

        Optional<Long> clienteViaWhatsapp = clienteWhatsAppRepository.findClienteIdByTelefoneNormalizado(digits);
        if (clienteViaWhatsapp.isPresent()) {
            String nome = nomeCliente(clienteRepository.findById(clienteViaWhatsapp.get()).orElse(null));
            if (StringUtils.hasText(nome)) {
                return nome;
            }
            String label = clienteWhatsAppRepository
                    .findNomeLabelByTelefoneNormalizado(digits)
                    .map(this::limparNomeLabel)
                    .orElse(null);
            if (StringUtils.hasText(label)) {
                return label;
            }
        }

        return pessoaContatoRepository
                .findPessoaIdByTelefoneNormalizado(digits)
                .flatMap(pessoaId -> clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoaId).stream()
                        .findFirst())
                .map(this::nomeCliente)
                .filter(StringUtils::hasText)
                .orElse(null);
    }

    private String nomeCliente(ClienteEntity cliente) {
        if (cliente == null) {
            return null;
        }
        PessoaEntity pessoa = cliente.getPessoa();
        if (pessoa != null && StringUtils.hasText(pessoa.getNome())) {
            return Utf8MojibakeUtil.corrigir(pessoa.getNome().trim());
        }
        if (StringUtils.hasText(cliente.getNomeReferencia())) {
            return cliente.getNomeReferencia().trim();
        }
        return null;
    }

    private String limparNomeLabel(String label) {
        if (!StringUtils.hasText(label)) {
            return null;
        }
        String limpo = label.trim();
        if (limpo.startsWith(PREFIXO_LABEL_WHATSAPP)) {
            limpo = limpo.substring(PREFIXO_LABEL_WHATSAPP.length()).trim();
        }
        return StringUtils.hasText(limpo) ? limpo : null;
    }

    private static String normalizarDigitos(String phoneNumber) {
        if (!StringUtils.hasText(phoneNumber)) {
            return null;
        }
        String digits = phoneNumber.replaceAll("\\D", "");
        return digits.isEmpty() ? null : digits;
    }
}
