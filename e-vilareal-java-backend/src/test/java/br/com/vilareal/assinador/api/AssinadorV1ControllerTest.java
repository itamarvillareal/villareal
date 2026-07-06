package br.com.vilareal.assinador.api;

import br.com.vilareal.assinador.AssinadorSecurityConstants;
import br.com.vilareal.assinador.api.dto.AssinadorArquivoResponse;
import br.com.vilareal.assinador.api.dto.AssinadorConcluirResponse;
import br.com.vilareal.assinador.api.dto.AssinadorLotePendenteResponse;
import br.com.vilareal.assinador.application.AssinadorApiService;
import br.com.vilareal.assinador.config.AssinadorApiProperties;
import br.com.vilareal.assinador.security.AssinadorAccessLogFilter;
import br.com.vilareal.assinador.security.AssinadorHttpsEnforcementFilter;
import br.com.vilareal.assinador.security.AssinadorSecretAuthFilter;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AssinadorV1ControllerTest {

    private static final String SEGREDO = "test-assinador-secret-min-32-chars-long!!";

    @Mock
    private AssinadorApiService assinadorApiService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AssinadorApiProperties props = new AssinadorApiProperties();
        props.setSecret(SEGREDO);
        props.setRequireHttps(false);
        props.setLongPollIntervalMs(10);

        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.initialize();

        AssinadorV1Controller controller =
                new AssinadorV1Controller(assinadorApiService, props, scheduler);

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .addFilter(new AssinadorHttpsEnforcementFilter(props))
                .addFilter(new AssinadorAccessLogFilter(props))
                .addFilter(new AssinadorSecretAuthFilter(props))
                .build();
    }

    @Test
    void semSegredo_retorna401() throws Exception {
        mockMvc.perform(get("/api/assinador/v1/lotes/pendente")
                        .header(AssinadorSecurityConstants.HEADER_ASSINADOR_ID, "win-1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void segredoErrado_retorna401() throws Exception {
        mockMvc.perform(get("/api/assinador/v1/lotes/pendente")
                        .header(AssinadorSecurityConstants.HEADER_SECRET, "errado")
                        .header(AssinadorSecurityConstants.HEADER_ASSINADOR_ID, "win-1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void longPoll_claimImediato() throws Exception {
        when(assinadorApiService.tentarClaimProximoLote("win-1"))
                .thenReturn(Optional.of(new AssinadorLotePendenteResponse(
                        42L,
                        9L,
                        List.of(new AssinadorArquivoResponse(7L, 100L, 1, "100_1_abcd.pdf", "100_1_abcd.pdf.p7s", "sha")))));

        var mvcResult = mockMvc.perform(get("/api/assinador/v1/lotes/pendente?timeout=1")
                        .header(AssinadorSecurityConstants.HEADER_SECRET, SEGREDO)
                        .header(AssinadorSecurityConstants.HEADER_ASSINADOR_ID, "win-1"))
                .andReturn();

        mockMvc.perform(asyncDispatch(mvcResult))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.loteId").value(42))
                .andExpect(jsonPath("$.arquivos[0].arquivoId").value(7));
    }

    @Test
    void concluir_delegaAoService() throws Exception {
        when(assinadorApiService.concluirLote(eq(42L), eq("win-1"), any()))
                .thenReturn(new AssinadorConcluirResponse(
                        42L, "CONCLUIDO", 1, 1, JsonNodeFactory.instance.objectNode().put("pareadas", 1)));

        MockMultipartFile p7s = new MockMultipartFile(
                "arquivosP7s", "100_1_abcd.pdf.p7s", "application/pkcs7-signature", new byte[] {9});

        mockMvc.perform(multipart("/api/assinador/v1/lotes/42/concluir").file(p7s)
                        .header(AssinadorSecurityConstants.HEADER_SECRET, SEGREDO)
                        .header(AssinadorSecurityConstants.HEADER_ASSINADOR_ID, "win-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONCLUIDO"))
                .andExpect(jsonPath("$.pareadas").value(1));
    }

    @Test
    void falha_delegaAoService() throws Exception {
        mockMvc.perform(post("/api/assinador/v1/lotes/42/falha")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"TOKEN_OCUPADO\",\"mensagem\":\"ocupado\"}")
                        .header(AssinadorSecurityConstants.HEADER_SECRET, SEGREDO)
                        .header(AssinadorSecurityConstants.HEADER_ASSINADOR_ID, "win-1"))
                .andExpect(status().isNoContent());

        verify(assinadorApiService).registrarFalha(42L, "win-1", "TOKEN_OCUPADO", "ocupado");
    }

    @Test
    void semAssinadorId_retorna401NoFiltro() throws Exception {
        mockMvc.perform(get("/api/assinador/v1/lotes/pendente")
                        .header(AssinadorSecurityConstants.HEADER_SECRET, SEGREDO))
                .andExpect(status().isUnauthorized());
    }
}
