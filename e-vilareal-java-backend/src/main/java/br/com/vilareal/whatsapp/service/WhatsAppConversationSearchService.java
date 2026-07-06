package br.com.vilareal.whatsapp.service;

import br.com.vilareal.pessoa.application.TelefoneBuscaSupport;
import br.com.vilareal.pessoa.infrastructure.persistence.PessoaSpecifications;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.whatsapp.dto.WhatsAppConversationSearchItemDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class WhatsAppConversationSearchService {

    private final WhatsAppMessageRepository messageRepository;
    private final PessoaRepository pessoaRepository;
    private final PessoaContatoRepository pessoaContatoRepository;
    private final WhatsAppNomeExibicaoService nomeExibicaoService;

    public WhatsAppConversationSearchService(
            WhatsAppMessageRepository messageRepository,
            PessoaRepository pessoaRepository,
            PessoaContatoRepository pessoaContatoRepository,
            WhatsAppNomeExibicaoService nomeExibicaoService) {
        this.messageRepository = messageRepository;
        this.pessoaRepository = pessoaRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
        this.nomeExibicaoService = nomeExibicaoService;
    }

    @Transactional(readOnly = true)
    public List<WhatsAppConversationSearchItemDTO> buscar(String termo, int limit) {
        String term = termo != null ? termo.trim() : "";
        if (term.length() < 2) {
            return List.of();
        }
        int lim = Math.min(Math.max(limit, 1), 30);
        LinkedHashSet<String> phones = new LinkedHashSet<>();

        String digits = term.replaceAll("\\D", "");
        if (digits.length() >= 4) {
            phones.addAll(messageRepository.findPhoneNumbersByDigitsContaining(digits, lim));
        }
        phones.addAll(messageRepository.findPhoneNumbersByContactNameContaining(term, lim));

        var pessoas = pessoaRepository.findAll(
                PessoaSpecifications.comFiltros(true, term, null, null, null),
                PageRequest.of(0, 15));
        for (PessoaEntity pessoa : pessoas.getContent()) {
            for (String phone : telefonesCanonicosPessoa(pessoa.getId(), pessoa.getTelefone())) {
                if (messageRepository.existsByPhoneNumberAndDeletedAtIsNull(phone)) {
                    phones.add(phone);
                }
            }
        }

        List<String> lista = phones.stream().limit(lim).toList();
        if (lista.isEmpty()) {
            return List.of();
        }
        Map<String, String> nomes = nomeExibicaoService.resolverNomesPorTelefone(lista);
        List<WhatsAppConversationSearchItemDTO> out = new ArrayList<>();
        for (String phone : lista) {
            String nome = nomes.get(phone);
            out.add(new WhatsAppConversationSearchItemDTO(phone, StringUtils.hasText(nome) ? nome : null));
        }
        return out;
    }

    private Set<String> telefonesCanonicosPessoa(Long pessoaId, String telefonePrincipal) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        adicionarCanonico(out, telefonePrincipal);
        if (pessoaId != null) {
            pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(pessoaId).stream()
                    .filter(c -> c.getTipo() != null && "telefone".equalsIgnoreCase(c.getTipo().trim()))
                    .forEach(c -> adicionarCanonico(out, c.getValor()));
        }
        return out;
    }

    private static void adicionarCanonico(Set<String> out, String raw) {
        String digits = TelefoneBuscaSupport.normalizar(raw);
        if (!StringUtils.hasText(digits)) {
            return;
        }
        try {
            out.add(WhatsAppService.formatPhoneNumber(digits));
        } catch (IllegalArgumentException ignored) {
            for (String v : TelefoneBuscaSupport.variantes(digits)) {
                try {
                    out.add(WhatsAppService.formatPhoneNumber(v));
                } catch (IllegalArgumentException ignoredVariant) {
                    /* próxima variante */
                }
            }
        }
    }
}
