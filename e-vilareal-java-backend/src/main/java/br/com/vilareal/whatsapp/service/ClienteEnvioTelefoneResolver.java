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

    /**
     * Telefone canônico com metadados de origem (para iniciar conversa a partir do cadastro).
     */
    public record TelefoneEnvioDetalhe(String numeroCanonico, String label, boolean principal) {}

    public List<TelefoneEnvioDetalhe> resolverTelefonesDetalhados(ClienteEntity cliente) {
        if (cliente == null) {
            return List.of();
        }

        List<ClienteWhatsAppEntity> whatsappCadastro =
                clienteWhatsAppRepository.findByCliente_IdAndAtivoTrueOrderByPrincipalDescIdAsc(cliente.getId());
        if (!whatsappCadastro.isEmpty()) {
            LinkedHashSet<String> vistos = new LinkedHashSet<>();
            List<TelefoneEnvioDetalhe> out = new ArrayList<>();
            for (ClienteWhatsAppEntity w : whatsappCadastro) {
                adicionarDetalheSeValido(out, vistos, w.getNumero(), labelWhatsApp(w), Boolean.TRUE.equals(w.getPrincipal()));
            }
            return List.copyOf(out);
        }

        PessoaEntity pessoa = cliente.getPessoa();
        if (pessoa == null) {
            return List.of();
        }

        LinkedHashSet<String> vistos = new LinkedHashSet<>();
        List<TelefoneEnvioDetalhe> out = new ArrayList<>();
        List<PessoaContatoEntity> contatos = pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(pessoa.getId());
        for (PessoaContatoEntity c : contatos) {
            if (c.getTipo() != null && "telefone".equalsIgnoreCase(c.getTipo().trim())) {
                adicionarDetalheSeValido(out, vistos, c.getValor(), "Contato telefone", false);
            }
        }
        adicionarDetalheSeValido(out, vistos, pessoa.getTelefone(), "Telefone cadastro", false);
        return List.copyOf(out);
    }

    public List<String> resolverTelefonesCliente(ClienteEntity cliente) {
        return resolverTelefonesDetalhados(cliente).stream()
                .map(TelefoneEnvioDetalhe::numeroCanonico)
                .toList();
    }

    private static String labelWhatsApp(ClienteWhatsAppEntity w) {
        if (Boolean.TRUE.equals(w.getPrincipal())) {
            return "WhatsApp principal";
        }
        if (StringUtils.hasText(w.getNomeLabel())) {
            return w.getNomeLabel().trim();
        }
        return "WhatsApp cadastro";
    }

    private static void adicionarDetalheSeValido(
            List<TelefoneEnvioDetalhe> destino,
            Set<String> vistos,
            String raw,
            String label,
            boolean principal) {
        if (!StringUtils.hasText(raw)) {
            return;
        }
        try {
            String canonico = WhatsAppService.formatPhoneNumber(raw.trim());
            if (vistos.add(canonico)) {
                destino.add(new TelefoneEnvioDetalhe(canonico, label, principal));
            } else if (principal) {
                for (int i = 0; i < destino.size(); i++) {
                    TelefoneEnvioDetalhe item = destino.get(i);
                    if (item.numeroCanonico().equals(canonico) && !item.principal()) {
                        destino.set(i, new TelefoneEnvioDetalhe(canonico, label, true));
                        break;
                    }
                }
            }
        } catch (IllegalArgumentException ignored) {
            // ignora número inválido
        }
    }
}
