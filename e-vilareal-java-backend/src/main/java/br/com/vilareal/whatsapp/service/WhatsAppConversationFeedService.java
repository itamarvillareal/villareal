package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.WhatsAppMessageDtoMapper;
import br.com.vilareal.whatsapp.dto.WhatsAppMessageDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.CobrancaWhatsAppEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class WhatsAppConversationFeedService {

    private static final Set<String> STATUS_COBRANCA_EXIBIVEL =
            Set.of("ENVIADO", "ENTREGUE", "LIDO");

    private final WhatsAppMessageRepository messageRepository;
    private final CobrancaWhatsAppRepository cobrancaRepository;
    private final WhatsAppNomeExibicaoService nomeExibicaoService;

    public WhatsAppConversationFeedService(
            WhatsAppMessageRepository messageRepository,
            CobrancaWhatsAppRepository cobrancaRepository,
            WhatsAppNomeExibicaoService nomeExibicaoService) {
        this.messageRepository = messageRepository;
        this.cobrancaRepository = cobrancaRepository;
        this.nomeExibicaoService = nomeExibicaoService;
    }

    @Transactional(readOnly = true)
    public Page<WhatsAppMessageDTO> listarMensagens(String phoneNumber, Pageable pageable) {
        String normalized = WhatsAppService.formatPhoneNumber(phoneNumber);
        String suffix = WhatsAppConversationContextService.sufixo11(normalized);
        if (!StringUtils.hasText(suffix)) {
            return Page.empty(pageable);
        }

        List<WhatsAppMessageEntity> entities = messageRepository.findByPhoneSuffixOrderByCreatedAtDesc(suffix);
        Set<String> waIdsPresentes = new HashSet<>();
        List<WhatsAppMessageDTO> feed = new ArrayList<>();

        Map<String, String> nomesCadastro =
                nomeExibicaoService.resolverNomesPorTelefone(List.of(normalized));

        for (WhatsAppMessageEntity entity : entities) {
            if (StringUtils.hasText(entity.getWaMessageId())) {
                waIdsPresentes.add(entity.getWaMessageId());
            }
            feed.add(toMessageDto(entity, nomesCadastro));
        }

        List<CobrancaWhatsAppEntity> cobrancas =
                cobrancaRepository.findRecentesPorSufixoTelefone(Instant.EPOCH, List.of(suffix));
        for (CobrancaWhatsAppEntity cobranca : cobrancas) {
            if (!deveExibirCobranca(cobranca, waIdsPresentes)) {
                continue;
            }
            feed.add(cobrancaToMessageDto(cobranca, normalized));
        }

        feed.sort(Comparator.comparing(WhatsAppMessageDTO::createdAt, Comparator.nullsLast(Comparator.reverseOrder())));

        int start = (int) pageable.getOffset();
        if (start >= feed.size()) {
            return new PageImpl<>(List.of(), pageable, feed.size());
        }
        int end = Math.min(start + pageable.getPageSize(), feed.size());
        return new PageImpl<>(feed.subList(start, end), pageable, feed.size());
    }

    private boolean deveExibirCobranca(CobrancaWhatsAppEntity cobranca, Set<String> waIdsPresentes) {
        if (cobranca == null) {
            return false;
        }
        String status = String.valueOf(cobranca.getStatus()).trim().toUpperCase(Locale.ROOT);
        if (!STATUS_COBRANCA_EXIBIVEL.contains(status)) {
            return false;
        }
        String waId = cobranca.getWaMessageId();
        return !StringUtils.hasText(waId) || !waIdsPresentes.contains(waId);
    }

    private WhatsAppMessageDTO cobrancaToMessageDto(CobrancaWhatsAppEntity cobranca, String phoneFallback) {
        String primeiroNome = extrairPrimeiroNome(cobranca.getPessoaNome());
        String conteudo = montarTextoCobranca(
                primeiroNome, cobranca.getUnidadeDescricao(), cobranca.getCondominioNome());

        Instant quando = cobranca.getEnviadoAt() != null ? cobranca.getEnviadoAt() : cobranca.getCreatedAt();
        String phone = StringUtils.hasText(cobranca.getPhoneNumber()) ? cobranca.getPhoneNumber() : phoneFallback;

        return new WhatsAppMessageDTO(
                -cobranca.getId(),
                cobranca.getWaMessageId(),
                phone,
                cobranca.getPessoaNome(),
                WhatsAppMessageDirection.OUTBOUND.name(),
                "TEMPLATE",
                conteudo,
                CobrancaWhatsAppService.TEMPLATE_COBRANCA,
                mapStatusCobranca(cobranca.getStatus()),
                cobranca.getClienteId(),
                cobranca.getProcessoId(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                quando);
    }

    private WhatsAppMessageDTO toMessageDto(WhatsAppMessageEntity entity, Map<String, String> nomesCadastro) {
        return WhatsAppMessageDtoMapper.fromEntity(
                entity,
                nomeExibicaoService.resolverNomeExibido(
                        entity.getPhoneNumber(), entity.getContactName(), nomesCadastro));
    }

    private static String mapStatusCobranca(String status) {
        if (!StringUtils.hasText(status)) {
            return "SENT";
        }
        return switch (status.trim().toUpperCase(Locale.ROOT)) {
            case "ENTREGUE" -> "DELIVERED";
            case "LIDO" -> "READ";
            default -> "SENT";
        };
    }

    private static String extrairPrimeiroNome(String nome) {
        if (!StringUtils.hasText(nome)) {
            return "Cliente";
        }
        return nome.trim().split("\\s+")[0];
    }

    private static String montarTextoCobranca(String nome, String unidade, String condominio) {
        String u = StringUtils.hasText(unidade) ? unidade.trim() : "unidade";
        String c = StringUtils.hasText(condominio) ? condominio.trim() : null;
        if (c != null) {
            return "Olá %s, identificamos pendência referente à %s no %s.".formatted(nome, u, c);
        }
        return "Olá %s, identificamos pendência referente à %s.".formatted(nome, u);
    }
}
