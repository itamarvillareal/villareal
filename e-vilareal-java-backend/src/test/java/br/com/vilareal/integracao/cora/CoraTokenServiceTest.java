package br.com.vilareal.integracao.cora;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CoraTokenServiceTest {

    @Mock
    private CoraMtlsHttpClient httpClient;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private CoraTokenService service;

    @BeforeEach
    void setUp() {
        service = new CoraTokenService(testSettings(), httpClient, objectMapper);
    }

    @Test
    void getToken_usaCacheEnquantoValido() {
        service.setCachedTokenForTest("cached-token-abcdefghij", Instant.now().plusSeconds(3600));

        assertThat(service.getToken()).isEqualTo("cached-token-abcdefghij");
        verify(httpClient, never()).postForm(any(), any(), any());
    }

    @Test
    void getToken_renovaQuandoPertoDeExpirar() throws Exception {
        service.setCachedTokenForTest("expiring-token-abcdefghij", Instant.now().plusSeconds(60));

        when(httpClient.postForm(contains("/token"), any(), any()))
                .thenReturn(tokenResponse("fresh-token-abcdefghijkl", 86400));

        assertThat(service.getToken()).isEqualTo("fresh-token-abcdefghijkl");
        verify(httpClient, times(1)).postForm(contains("/token"), any(), any());
    }

    @Test
    void getToken_segundaChamadaNaoRefazHttp() throws Exception {
        when(httpClient.postForm(contains("/token"), any(), any()))
                .thenReturn(tokenResponse("stable-token-abcdefghijkl", 86400));

        assertThat(service.getToken()).isEqualTo("stable-token-abcdefghijkl");
        assertThat(service.getToken()).isEqualTo("stable-token-abcdefghijkl");
        verify(httpClient, times(1)).postForm(contains("/token"), any(), any());
    }

    private static CoraTokenSettings testSettings() {
        return new CoraTokenSettings() {
            @Override
            public String getClientId() {
                return "test-client-id";
            }

            @Override
            public String getTokenBaseUrl() {
                return "https://matls-clients.api.stage.cora.com.br";
            }

            @Override
            public int getTokenRefreshSkewSeconds() {
                return 300;
            }
        };
    }

    private static CoraHttpResponse tokenResponse(String accessToken, int expiresIn) throws Exception {
        String body = new ObjectMapper()
                .writeValueAsString(Map.of("access_token", accessToken, "expires_in", expiresIn));
        return new CoraHttpResponse(200, body, Map.of());
    }
}
