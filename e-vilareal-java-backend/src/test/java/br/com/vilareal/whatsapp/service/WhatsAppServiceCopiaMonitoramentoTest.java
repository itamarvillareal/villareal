package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.dto.WhatsAppSendResponse;
import br.com.vilareal.whatsapp.dto.WhatsAppTextMessageRequest;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.AniversarioWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class WhatsAppServiceCopiaMonitoramentoTest {

    private static final String SUCCESS_JSON =
            """
            {"messaging_product":"whatsapp","messages":[{"id":"wamid.test"}]}
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

    private final ObjectMapper objectMapper = new ObjectMapper();

    private HttpServer httpServer;
    private final List<String> requestBodies = new ArrayList<>();
    private CountDownLatch requestsLatch;
    private AtomicInteger responseStatus = new AtomicInteger(200);
    private WhatsAppConfig whatsAppConfig;
    private WhatsAppService whatsAppService;

    @BeforeEach
    void setUp() throws IOException {
        requestBodies.clear();
        responseStatus.set(200);
        requestsLatch = new CountDownLatch(1);

        httpServer = HttpServer.create(new InetSocketAddress(0), 0);
        httpServer.createContext(
                "/",
                exchange -> {
                    requestBodies.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                    requestsLatch.countDown();
                    byte[] body = SUCCESS_JSON.getBytes(StandardCharsets.UTF_8);
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

        org.mockito.Mockito.lenient().when(whatsAppIAConfigService.isIaHabilitada()).thenReturn(true);

        whatsAppService = newService();
    }

    private WhatsAppService newService() {
        return new WhatsAppService(
                whatsAppConfig,
                RestClient.builder(),
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
    }

    @AfterEach
    void tearDown() {
        if (httpServer != null) {
            httpServer.stop(0);
        }
    }

    @Test
    void sendTextMessage_envioNormalDisparaUmaCopia() throws Exception {
        requestsLatch = new CountDownLatch(2);

        WhatsAppSendResponse response = whatsAppService.sendTextMessage("62988765432", "Olá cliente");

        assertThat(extractMessageId(response)).isEqualTo("wamid.test");
        assertThat(requestsLatch.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(requestBodies).hasSize(2);

        WhatsAppTextMessageRequest original =
                objectMapper.readValue(requestBodies.get(0), WhatsAppTextMessageRequest.class);
        assertThat(original.to()).isEqualTo("5562988765432");
        assertThat(original.text().body()).isEqualTo("Olá cliente");

        WhatsAppTextMessageRequest copia =
                objectMapper.readValue(requestBodies.get(1), WhatsAppTextMessageRequest.class);
        assertThat(copia.to()).isEqualTo("5562982345000");
        assertThat(copia.text().body())
                .isEqualTo("[cópia] texto para 5562988765432: Olá cliente");
    }

    @Test
    void sendTextMessage_copiaNaoGeraOutraCopia() throws Exception {
        requestsLatch = new CountDownLatch(2);
        whatsAppService.sendTextMessage("62988765432", "msg");
        assertThat(requestsLatch.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(requestBodies).hasSize(2);
        WhatsAppTextMessageRequest copia =
                objectMapper.readValue(requestBodies.get(1), WhatsAppTextMessageRequest.class);
        assertThat(copia.text().body()).startsWith("[cópia]");
        Thread.sleep(200);
        assertThat(requestBodies).hasSize(2);
    }

    @Test
    void sendTextMessage_destinoMonitoramentoNaoCopia() throws Exception {
        requestsLatch = new CountDownLatch(1);

        whatsAppService.sendTextMessage("+5562982345000", "direto no monitor");

        assertThat(requestsLatch.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(requestBodies).hasSize(1);
    }

    @Test
    void sendTextMessage_falhaNaCopiaNaoDerrubaEnvioReal() throws Exception {
        requestsLatch = new CountDownLatch(2);
        AtomicInteger call = new AtomicInteger();
        httpServer.stop(0);
        httpServer = HttpServer.create(new InetSocketAddress(0), 0);
        httpServer.createContext(
                "/",
                exchange -> {
                    int n = call.incrementAndGet();
                    requestBodies.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                    requestsLatch.countDown();
                    if (n == 1) {
                        byte[] body = SUCCESS_JSON.getBytes(StandardCharsets.UTF_8);
                        exchange.getResponseHeaders().put("Content-Type", Collections.singletonList("application/json"));
                        exchange.sendResponseHeaders(200, body.length);
                        try (OutputStream os = exchange.getResponseBody()) {
                            os.write(body);
                        }
                    } else {
                        byte[] err = "{\"error\":{\"message\":\"fail\"}}".getBytes(StandardCharsets.UTF_8);
                        exchange.getResponseHeaders().put("Content-Type", Collections.singletonList("application/json"));
                        exchange.sendResponseHeaders(500, err.length);
                        try (OutputStream os = exchange.getResponseBody()) {
                            os.write(err);
                        }
                    }
                });
        httpServer.start();
        whatsAppConfig.setApiUrl("http://localhost:" + httpServer.getAddress().getPort());
        whatsAppService = newService();

        assertThatCode(() -> whatsAppService.sendTextMessage("62988765432", "ok"))
                .doesNotThrowAnyException();
        assertThat(requestsLatch.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(requestBodies).hasSize(2);
    }

    @Test
    void sendTextMessage_copiaMonitoramentoDesativadaNaoEnviaCopia() throws Exception {
        whatsAppConfig.getCopiaMonitoramento().setAtivo(false);
        requestsLatch = new CountDownLatch(1);

        whatsAppService.sendTextMessage("62988765432", "sem cópia");

        assertThat(requestsLatch.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(requestBodies).hasSize(1);
    }

    @Test
    void sendTemplateMessage_envioNormalDisparaCopiaComResumoTemplate() throws Exception {
        requestsLatch = new CountDownLatch(2);

        whatsAppService.sendTemplateMessage(
                "62988765432", "atualizacao_processo", "pt_BR", List.of("Maria", "123", "mov"));

        assertThat(requestsLatch.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(requestBodies).hasSize(2);

        WhatsAppTextMessageRequest copia =
                objectMapper.readValue(requestBodies.get(1), WhatsAppTextMessageRequest.class);
        assertThat(copia.text().body())
                .isEqualTo(
                        "[cópia] template para 5562988765432: atualizacao_processo (Maria, 123, mov)");
    }

    @Test
    void montarTextoCopiaMonitoramento_formatoEsperado() {
        assertThat(WhatsAppService.montarTextoCopiaMonitoramento("texto", "5562999999999", "oi"))
                .isEqualTo("[cópia] texto para 5562999999999: oi");
    }

    @Test
    void sendTextMessage_falhaEnvioRealPropagaErroSemTentarCopia() {
        responseStatus.set(500);
        requestsLatch = new CountDownLatch(1);

        assertThatThrownBy(() -> whatsAppService.sendTextMessage("62988765432", "falha"))
                .isInstanceOf(WhatsAppApiException.class);
        assertThat(requestBodies).hasSize(1);
    }

    private static String extractMessageId(WhatsAppSendResponse response) {
        return response.messages().getFirst().id();
    }
}
