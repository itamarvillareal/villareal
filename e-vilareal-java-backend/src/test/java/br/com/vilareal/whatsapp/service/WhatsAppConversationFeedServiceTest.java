package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.WhatsAppMessageDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppMessageSearchResultDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.CobrancaWhatsAppEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppConversationFeedServiceTest {

    private static final String PHONE = "556293191778";

    @Mock
    private WhatsAppMessageRepository messageRepository;

    @Mock
    private CobrancaWhatsAppRepository cobrancaRepository;

    @Mock
    private WhatsAppNomeExibicaoService nomeExibicaoService;

    private WhatsAppConversationFeedService service;

    @BeforeEach
    void setUp() {
        service = new WhatsAppConversationFeedService(messageRepository, cobrancaRepository, nomeExibicaoService);
    }

    @Test
    void listarMensagens_incluiCobrancaQuandoNaoPersistidaEmWhatsappMessages() {
        WhatsAppMessageEntity inbound = new WhatsAppMessageEntity();
        inbound.setId(1L);
        inbound.setPhoneNumber(PHONE);
        inbound.setDirection(br.com.vilareal.whatsapp.WhatsAppMessageDirection.INBOUND);
        inbound.setMessageType(br.com.vilareal.whatsapp.WhatsAppMessageType.TEXT);
        inbound.setContent("Referente a que débito?");
        inbound.setCreatedAt(Instant.parse("2026-06-29T13:08:00Z"));

        CobrancaWhatsAppEntity cobranca = new CobrancaWhatsAppEntity();
        cobranca.setId(99L);
        cobranca.setPhoneNumber(PHONE);
        cobranca.setPessoaNome("Reinaldo Caetano");
        cobranca.setUnidadeDescricao("Unidade A-101");
        cobranca.setCondominioNome("Residencial Teste");
        cobranca.setStatus("ENVIADO");
        cobranca.setWaMessageId("wamid.cobranca");
        cobranca.setEnviadoAt(Instant.parse("2026-06-29T13:00:00Z"));

        when(messageRepository.findByPhoneSuffixOrderByCreatedAtDesc(any())).thenReturn(List.of(inbound));
        when(cobrancaRepository.findRecentesPorSufixoTelefone(any(), anyCollection())).thenReturn(List.of(cobranca));
        when(nomeExibicaoService.resolverNomesPorTelefone(anyList())).thenReturn(Map.of(PHONE, "Reinaldo Caetano"));
        when(nomeExibicaoService.resolverNomeExibido(any(), any(), any())).thenReturn("Reinaldo Caetano");

        Page<WhatsAppMessageDTO> page = service.listarMensagens(PHONE, PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent())
                .extracting(WhatsAppMessageDTO::templateName)
                .contains(CobrancaWhatsAppService.TEMPLATE_COBRANCA);
        assertThat(page.getContent().stream().filter(m -> m.templateName() != null).findFirst())
                .get()
                .extracting(WhatsAppMessageDTO::content)
                .asString()
                .contains("Olá Reinaldo");
    }

    @Test
    void buscarMensagens_encontraTextoELegendaIgnoraReaction() {
        WhatsAppMessageEntity text = entity(1L, br.com.vilareal.whatsapp.WhatsAppMessageType.TEXT, "Boleto vencido", "2026-06-29T13:10:00Z");
        WhatsAppMessageEntity image = entity(2L, br.com.vilareal.whatsapp.WhatsAppMessageType.IMAGE, "Comprovante PIX", "2026-06-29T13:11:00Z");
        WhatsAppMessageEntity reaction = entity(3L, br.com.vilareal.whatsapp.WhatsAppMessageType.REACTION, "👍", "2026-06-29T13:12:00Z");

        when(messageRepository.findByPhoneSuffixOrderByCreatedAtDesc(any())).thenReturn(List.of(reaction, image, text));
        when(cobrancaRepository.findRecentesPorSufixoTelefone(any(), anyCollection())).thenReturn(List.of());
        when(nomeExibicaoService.resolverNomesPorTelefone(anyList())).thenReturn(Map.of(PHONE, "Contato"));
        when(nomeExibicaoService.resolverNomeExibido(any(), any(), any())).thenReturn("Contato");

        WhatsAppMessageSearchResultDTO boleto = service.buscarMensagens(PHONE, "boleto");
        assertThat(boleto.total()).isEqualTo(1);
        assertThat(boleto.messageIds()).containsExactly(1L);

        WhatsAppMessageSearchResultDTO pix = service.buscarMensagens(PHONE, "pix");
        assertThat(pix.total()).isEqualTo(1);
        assertThat(pix.messageIds()).containsExactly(2L);

        WhatsAppMessageSearchResultDTO reactionSearch = service.buscarMensagens(PHONE, "👍");
        assertThat(reactionSearch.total()).isZero();
    }

    @Test
    void buscarMensagens_termoCurtoRetornaVazio() {
        WhatsAppMessageSearchResultDTO result = service.buscarMensagens(PHONE, "a");
        assertThat(result.total()).isZero();
        assertThat(result.messageIds()).isEmpty();
        assertThat(result.matches()).isEmpty();
    }

    @Test
    void buscarMensagens_naoRetornaQuandoRepositorioFiltraSoftDeleted() {
        WhatsAppMessageEntity ativa = entity(1L, br.com.vilareal.whatsapp.WhatsAppMessageType.TEXT, "visível", "2026-06-29T13:10:00Z");
        when(messageRepository.findByPhoneSuffixOrderByCreatedAtDesc(any())).thenReturn(List.of(ativa));
        when(cobrancaRepository.findRecentesPorSufixoTelefone(any(), anyCollection())).thenReturn(List.of());
        when(nomeExibicaoService.resolverNomesPorTelefone(anyList())).thenReturn(Map.of(PHONE, "Contato"));
        when(nomeExibicaoService.resolverNomeExibido(any(), any(), any())).thenReturn("Contato");

        assertThat(service.buscarMensagens(PHONE, "visível").total()).isEqualTo(1);

        when(messageRepository.findByPhoneSuffixOrderByCreatedAtDesc(any())).thenReturn(List.of());
        assertThat(service.buscarMensagens(PHONE, "visível").total()).isZero();
    }

    @Test
    void listarMensagens_conversaApagadaReabreComMensagemNova() {
        when(messageRepository.findByPhoneSuffixOrderByCreatedAtDesc(any())).thenReturn(List.of());
        when(cobrancaRepository.findRecentesPorSufixoTelefone(any(), anyCollection())).thenReturn(List.of());

        Page<WhatsAppMessageDTO> vazia = service.listarMensagens(PHONE, PageRequest.of(0, 20));
        assertThat(vazia.getTotalElements()).isZero();

        WhatsAppMessageEntity nova = entity(10L, br.com.vilareal.whatsapp.WhatsAppMessageType.TEXT, "Olá de novo", "2026-06-30T10:00:00Z");
        when(messageRepository.findByPhoneSuffixOrderByCreatedAtDesc(any())).thenReturn(List.of(nova));
        when(nomeExibicaoService.resolverNomesPorTelefone(anyList())).thenReturn(Map.of(PHONE, "Contato"));
        when(nomeExibicaoService.resolverNomeExibido(any(), any(), any())).thenReturn("Contato");

        Page<WhatsAppMessageDTO> reaberta = service.listarMensagens(PHONE, PageRequest.of(0, 20));
        assertThat(reaberta.getTotalElements()).isEqualTo(1);
        assertThat(reaberta.getContent().getFirst().content()).contains("Olá de novo");
    }

    private static WhatsAppMessageEntity entity(
            Long id, br.com.vilareal.whatsapp.WhatsAppMessageType type, String content, String createdAt) {
        WhatsAppMessageEntity entity = new WhatsAppMessageEntity();
        entity.setId(id);
        entity.setPhoneNumber(PHONE);
        entity.setDirection(br.com.vilareal.whatsapp.WhatsAppMessageDirection.INBOUND);
        entity.setMessageType(type);
        entity.setContent(content);
        entity.setCreatedAt(Instant.parse(createdAt.endsWith("Z") ? createdAt : createdAt + "Z"));
        return entity;
    }
}
