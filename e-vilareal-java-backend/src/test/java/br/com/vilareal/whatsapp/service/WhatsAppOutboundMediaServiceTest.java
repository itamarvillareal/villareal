package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.config.WhatsAppMediaProperties;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.WhatsAppMediaCategory;
import br.com.vilareal.whatsapp.WhatsAppMediaStatus;
import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.WhatsAppMessageType;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.AniversarioWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppOutboundMediaServiceTest {

    private static final String UPLOAD_JSON = "{\"id\":\"meta-media-123\"}";
    private static final String SEND_JSON =
            """
            {"messaging_product":"whatsapp","messages":[{"id":"wamid.outbound.media"}]}
            """;

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
    private WhatsAppContactResolverService contactResolver;

    @Mock
    private WhatsAppMediaOutboundDriveService outboundDriveService;

    private HttpServer httpServer;
    private final List<String> requestPaths = new ArrayList<>();
    private final AtomicInteger responseStatus = new AtomicInteger(200);
    private WhatsAppConfig whatsAppConfig;
    private WhatsAppService whatsAppService;
    private WhatsAppMediaUploadService uploadService;
    private WhatsAppOutboundMediaStagingService stagingService;
    private WhatsAppOutboundMediaService outboundMediaService;

    @BeforeEach
    void setUp() throws IOException {
        requestPaths.clear();
        responseStatus.set(200);

        httpServer = HttpServer.create(new InetSocketAddress(0), 0);
        httpServer.createContext(
                "/",
                exchange -> {
                    requestPaths.add(exchange.getRequestURI().getPath());
                    byte[] body = exchange.getRequestURI().getPath().contains("/media")
                            ? UPLOAD_JSON.getBytes(StandardCharsets.UTF_8)
                            : SEND_JSON.getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().put("Content-Type", Collections.singletonList("application/json"));
                    exchange.sendResponseHeaders(responseStatus.get(), body.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(body);
                    }
                });
        httpServer.start();

        whatsAppConfig = new WhatsAppConfig();
        whatsAppConfig.setPhoneNumberId("phone-test");
        whatsAppConfig.setAccessToken("token-test");
        whatsAppConfig.setApiUrl("http://localhost:" + httpServer.getAddress().getPort());

        ObjectMapper objectMapper = new ObjectMapper();
        RestClient.Builder builder = RestClient.builder();

        whatsAppService = new WhatsAppService(
                whatsAppConfig,
                builder,
                objectMapper,
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
                org.mockito.Mockito.mock(WhatsAppConversationArchiveService.class));

        uploadService = new WhatsAppMediaUploadService(whatsAppConfig, builder, objectMapper);
        stagingService = new WhatsAppOutboundMediaStagingService();
        outboundMediaService = new WhatsAppOutboundMediaService(
                new WhatsAppMediaValidation(new WhatsAppMediaProperties()),
                uploadService,
                whatsAppService,
                contactResolver,
                stagingService,
                outboundDriveService);
    }

    @AfterEach
    void tearDown() {
        if (httpServer != null) {
            httpServer.stop(0);
        }
    }

    @Test
    void enviarMidiaImagemFazUploadSendPersisteEstagia() throws IOException {
        Path temp = Files.createTempFile("wa-out-test-", ".jpg");
        Files.write(temp, new byte[] {1, 2, 3});

        WhatsAppMessageEntity saved = new WhatsAppMessageEntity();
        saved.setId(42L);
        when(contactResolver.resolveContactName(any(), any())).thenReturn("Cliente Teste");
        when(whatsAppMessageRepository.save(any())).thenAnswer(inv -> {
            WhatsAppMessageEntity e = inv.getArgument(0);
            e.setId(42L);
            return e;
        });

        var result = outboundMediaService.enviarMidia("11987654321", temp, "foto.jpg", "image/jpeg", "Olá");

        assertThat(result.messageId()).isEqualTo(42L);
        assertThat(result.waMessageId()).isEqualTo("wamid.outbound.media");
        assertThat(result.mediaStatus()).isEqualTo(WhatsAppMediaStatus.PENDING);
        assertThat(requestPaths).anyMatch(p -> p.contains("/media"));
        assertThat(requestPaths).anyMatch(p -> p.contains("/messages"));
        assertThat(Files.exists(temp)).isFalse();

        ArgumentCaptor<WhatsAppMessageEntity> captor = ArgumentCaptor.forClass(WhatsAppMessageEntity.class);
        verify(whatsAppMessageRepository).save(captor.capture());
        WhatsAppMessageEntity persisted = captor.getValue();
        assertThat(persisted.getDirection()).isEqualTo(WhatsAppMessageDirection.OUTBOUND);
        assertThat(persisted.getMessageType()).isEqualTo(WhatsAppMessageType.IMAGE);
        assertThat(persisted.getMediaId()).isEqualTo("meta-media-123");
        assertThat(persisted.getMediaMimeType()).isEqualTo("image/jpeg");
        assertThat(persisted.getMediaFilename()).isEqualTo("foto.jpg");
        assertThat(persisted.getMediaStatus()).isEqualTo(WhatsAppMediaStatus.PENDING);
        assertThat(persisted.getContent()).isEqualTo("Olá");
        assertThat(persisted.getContactName()).isEqualTo("Cliente Teste");

        assertThat(stagingService.takeStagedFile(42L)).isPresent();
        verify(outboundDriveService).agendarSalvarMidiaEnviadaNoDrive(42L);
        stagingService.deleteStaged(42L);
    }

    @Test
    void rejeitaArquivoAcimaDoLimiteSemChamarMeta() throws IOException {
        Path temp = Files.createTempFile("wa-out-big-", ".jpg");
        Files.write(temp, new byte[(int) (6L * 1024 * 1024)]);

        assertThatThrownBy(() ->
                        outboundMediaService.enviarMidia("11987654321", temp, "big.jpg", "image/jpeg", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("excede o limite");

        verify(whatsAppMessageRepository, never()).save(any());
        assertThat(requestPaths).isEmpty();
        assertThat(Files.exists(temp)).isFalse();
    }

    @Test
    void falhaNoUploadNaoPersiste() throws IOException {
        responseStatus.set(400);
        Path temp = Files.createTempFile("wa-out-fail-", ".jpg");
        Files.write(temp, new byte[] {9});

        assertThatThrownBy(() ->
                        outboundMediaService.enviarMidia("11987654321", temp, "f.jpg", "image/jpeg", null))
                .isInstanceOf(WhatsAppApiException.class);

        verify(whatsAppMessageRepository, never()).save(any());
        assertThat(Files.exists(temp)).isFalse();
    }

    @Test
    void montarRequestPorCategoria() {
        assertThat(WhatsAppService.montarConteudoOutboundMedia(WhatsAppMediaCategory.IMAGE, null, null))
                .isEqualTo("📷 Imagem");
        assertThat(WhatsAppService.montarConteudoOutboundMedia(WhatsAppMediaCategory.DOCUMENT, "contrato.pdf", null))
                .isEqualTo("📄 contrato.pdf");
        assertThat(WhatsAppService.montarConteudoOutboundMedia(WhatsAppMediaCategory.AUDIO, null, null))
                .isEqualTo("🎵 Áudio");
    }
}
