package br.com.vilareal.projudi.application;

import br.com.vilareal.configuracao.application.SistemaConfigService;
import br.com.vilareal.projudi.config.ProjudiProtocoloEmailProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjudiProtocoloEmailConfigServiceTest {

    @Mock private SistemaConfigService sistemaConfigService;

    private ProjudiProtocoloEmailProperties properties;
    private ProjudiProtocoloEmailConfigService service;

    @BeforeEach
    void setUp() {
        properties = new ProjudiProtocoloEmailProperties();
        service = new ProjudiProtocoloEmailConfigService(sistemaConfigService, properties);
    }

    @Test
    void getDestinatariosEfetivos_usaBancoQuandoConfigurado() {
        when(sistemaConfigService.obterValor(ProjudiProtocoloEmailConfigService.CHAVE_DESTINATARIOS))
                .thenReturn(Optional.of("jr.villareal@gmail.com, outro@example.com"));

        assertThat(service.getDestinatariosEfetivos())
                .containsExactly("jr.villareal@gmail.com", "outro@example.com");
    }

    @Test
    void getDestinatariosEfetivos_usaFallbackQuandoBancoVazio() {
        when(sistemaConfigService.obterValor(ProjudiProtocoloEmailConfigService.CHAVE_DESTINATARIOS))
                .thenReturn(Optional.empty());

        assertThat(service.getDestinatariosEfetivos())
                .containsExactly(ProjudiProtocoloEmailConfigService.FALLBACK_EMAIL);
    }

    @Test
    void salvarDestinatarios_gravaNoBanco() {
        List<String> salvo = service.salvarDestinatarios(List.of("JR.VILLAREAL@GMAIL.COM"));

        assertThat(salvo).containsExactly("jr.villareal@gmail.com");
        verify(sistemaConfigService)
                .salvarValor(ProjudiProtocoloEmailConfigService.CHAVE_DESTINATARIOS, "jr.villareal@gmail.com");
    }

    @Test
    void salvarDestinatarios_rejeitaListaVazia() {
        assertThatThrownBy(() -> service.salvarDestinatarios(List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
