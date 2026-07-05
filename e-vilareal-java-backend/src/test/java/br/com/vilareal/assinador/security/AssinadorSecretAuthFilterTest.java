package br.com.vilareal.assinador.security;

import br.com.vilareal.assinador.AssinadorSecurityConstants;
import br.com.vilareal.assinador.config.AssinadorApiProperties;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AssinadorSecretAuthFilterTest {

    private static final String SEGREDO = "test-assinador-secret-min-32-chars-long!!";

    @Mock
    private FilterChain chain;

    private AssinadorSecretAuthFilter filter;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        AssinadorApiProperties props = new AssinadorApiProperties();
        props.setSecret(SEGREDO);
        filter = new AssinadorSecretAuthFilter(props);
        response = new MockHttpServletResponse();
        SecurityContextHolder.clearContext();
    }

    @Test
    void ignoraRotasForaDoPrefixo() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/projudi/peticoes");
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void rejeitaSegredoAusente() throws Exception {
        MockHttpServletRequest request = requestAssinador("GET", "/api/assinador/v1/lotes/pendente");
        filter.doFilter(request, response, chain);
        assertThat(response.getStatus()).isEqualTo(401);
        verify(chain, never()).doFilter(request, response);
    }

    @Test
    void rejeitaSegredoErrado() throws Exception {
        MockHttpServletRequest request = requestAssinador("GET", "/api/assinador/v1/lotes/pendente");
        request.addHeader(AssinadorSecurityConstants.HEADER_SECRET, "errado");
        filter.doFilter(request, response, chain);
        assertThat(response.getStatus()).isEqualTo(401);
        verify(chain, never()).doFilter(request, response);
    }

    @Test
    void aceitaSegredoCorreto_eDefineRoleAssinador() throws Exception {
        MockHttpServletRequest request = requestAssinador("GET", "/api/assinador/v1/lotes/pendente");
        request.addHeader(AssinadorSecurityConstants.HEADER_SECRET, SEGREDO);
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    private static MockHttpServletRequest requestAssinador(String method, String path) {
        return new MockHttpServletRequest(method, path);
    }
}
