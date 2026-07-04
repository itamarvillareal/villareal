package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.AniversarioWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppServiceInboundPhoneTest {

    private static final String FROM_META_SEM_9 = "556292975894";
    private static final String CANONICO = "5562992975894";

    @Mock
    private WhatsAppMessageRepository whatsAppMessageRepository;

    @Mock
    private PessoaContatoRepository pessoaContatoRepository;

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private ClienteWhatsAppRepository clienteWhatsAppRepository;

    @Mock
    private AniversarioWhatsAppRepository aniversarioWhatsAppRepository;

    @Mock
    private CobrancaWhatsAppRepository cobrancaWhatsAppRepository;

    @Mock
    private WhatsAppAIService whatsAppAIService;

    @Mock
    private WhatsAppIAConfigService whatsAppIAConfigService;

    @Mock
    private WhatsAppMediaProcessingService whatsAppMediaProcessingService;

    @Mock
    private WhatsAppNotificationService whatsAppNotificationService;

    @Mock
    private WhatsAppConversationContextService conversationContextService;

    @Captor
    private ArgumentCaptor<WhatsAppMessageEntity> savedMessageCaptor;

    private WhatsAppService service;

    @BeforeEach
    void setUp() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setApiUrl("http://localhost");
        config.setAccessToken("token");

        service = new WhatsAppService(
                config,
                RestClient.builder(),
                new ObjectMapper(),
                whatsAppMessageRepository,
                pessoaContatoRepository,
                clienteRepository,
                clienteWhatsAppRepository,
                aniversarioWhatsAppRepository,
                cobrancaWhatsAppRepository,
                whatsAppAIService,
                whatsAppIAConfigService,
                whatsAppMediaProcessingService,
                whatsAppNotificationService,
                conversationContextService);

        lenient().when(whatsAppMessageRepository.findByWaMessageId(any())).thenReturn(Optional.empty());
        lenient().when(whatsAppMessageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(whatsAppIAConfigService.isIaHabilitada()).thenReturn(false);
    }

    @Test
    void processInboundMessage_metaSemNonoDigito_gravaPhoneCanonico() {
        service.processInboundMessage(
                FROM_META_SEM_9, "oi", "text", "wamid.inbound.1", "João", null, null, null);

        verify(whatsAppMessageRepository).save(savedMessageCaptor.capture());
        assertThat(savedMessageCaptor.getValue().getPhoneNumber()).isEqualTo(CANONICO);
    }

    @Test
    void processInboundMessage_metaSemNonoDigito_casaComOutboundCanonico() {
        WhatsAppMessageEntity outbound = new WhatsAppMessageEntity();
        outbound.setProcessoId(42L);
        outbound.setClienteId(7L);
        when(whatsAppMessageRepository.findFirstByPhoneNumberAndDirectionAndProcessoIdIsNotNullAndCreatedAtAfterOrderByCreatedAtDesc(
                        eq(CANONICO), eq(WhatsAppMessageDirection.OUTBOUND), any(Instant.class)))
                .thenReturn(Optional.of(outbound));

        service.processInboundMessage(
                FROM_META_SEM_9, "oi", "text", "wamid.inbound.2", "João", null, null, null);

        verify(whatsAppMessageRepository).save(savedMessageCaptor.capture());
        assertThat(savedMessageCaptor.getValue().getProcessoId()).isEqualTo(42L);
    }

    @Test
    void processInboundMessage_fixo_naoGanhaNonoDigito() {
        String fixo = "556232179999";

        service.processInboundMessage(fixo, "oi", "text", "wamid.inbound.fixo", "Escritório", null, null, null);

        verify(whatsAppMessageRepository).save(savedMessageCaptor.capture());
        assertThat(savedMessageCaptor.getValue().getPhoneNumber()).isEqualTo(fixo);
    }

    @Test
    void processInboundMessage_fromExotico_fallbackGravaOriginal() {
        String exotico = "999";

        service.processInboundMessage(exotico, "oi", "text", "wamid.inbound.exotico", null, null, null, null);

        verify(whatsAppMessageRepository).save(savedMessageCaptor.capture());
        assertThat(savedMessageCaptor.getValue().getPhoneNumber()).isEqualTo(exotico);
    }

    @Test
    void processInboundMessage_dedupePorWaMessageId_naoAfetado() {
        when(whatsAppMessageRepository.findByWaMessageId("wamid.duplicado"))
                .thenReturn(Optional.of(new WhatsAppMessageEntity()));

        service.processInboundMessage(
                FROM_META_SEM_9, "oi", "text", "wamid.duplicado", "João", null, null, null);

        verify(whatsAppMessageRepository, never()).save(any());
    }
}
