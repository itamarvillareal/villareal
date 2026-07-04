package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.AniversarioWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppServiceInboundArchiveTest {

    private static final String PHONE = "5562983452868";

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

    @Mock
    private WhatsAppConversationArchiveService conversationArchiveService;

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
                conversationContextService,
                conversationArchiveService);

        lenient().when(whatsAppMessageRepository.findByWaMessageId(any())).thenReturn(Optional.empty());
        lenient().when(whatsAppMessageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(whatsAppIAConfigService.isIaHabilitada()).thenReturn(false);
    }

    @Test
    void processInboundMessage_desarquivaAposSalvar() {
        service.processInboundMessage(PHONE, "oi", "text", "wamid.inbound.archive.1", "João", null, null, null);

        verify(conversationArchiveService).desarquivarSeExistir(PHONE);
    }

    @Test
    void processInboundMessage_reactionNaoDesarquiva() {
        service.processInboundMessage(PHONE, "👍", "reaction", "wamid.inbound.archive.reaction", "João", null, null, null);

        verify(conversationArchiveService, never()).desarquivarSeExistir(eq(PHONE));
    }

    @Test
    void processInboundMessage_duplicadaNaoDesarquiva() {
        when(whatsAppMessageRepository.findByWaMessageId("wamid.duplicado"))
                .thenReturn(Optional.of(new WhatsAppMessageEntity()));

        service.processInboundMessage(PHONE, "oi", "text", "wamid.duplicado", "João", null, null, null);

        verify(conversationArchiveService, never()).desarquivarSeExistir(any());
    }
}
