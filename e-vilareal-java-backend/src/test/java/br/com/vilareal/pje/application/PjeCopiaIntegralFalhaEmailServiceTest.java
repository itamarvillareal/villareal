package br.com.vilareal.pje.application;

import br.com.vilareal.notificacao.application.NotificacaoEmailService;
import br.com.vilareal.pje.config.PjeBrowserProperties;
import br.com.vilareal.pje.config.PjeCopiaIntegralFalhaEmailProperties;
import br.com.vilareal.pje.domain.PjeGrau;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PjeCopiaIntegralFalhaEmailServiceTest {

    @Mock
    private NotificacaoEmailService notificacaoEmailService;

    private PjeCopiaIntegralFalhaEmailProperties properties;
    private PjeBrowserProperties browserProperties;
    private PjeCopiaIntegralFalhaEmailService service;

    @BeforeEach
    void setUp() {
        properties = new PjeCopiaIntegralFalhaEmailProperties();
        properties.setAtivo(true);
        properties.setDestinatarios(List.of("itamarvillareal@gmail.com"));
        browserProperties = new PjeBrowserProperties();
        browserProperties.setProxy("socks5://100.123.21.81:1080");
        service = new PjeCopiaIntegralFalhaEmailService(
                notificacaoEmailService, properties, browserProperties);
    }

    @Test
    void notificarFalhaDefinitiva_enviaComCnjEProxy() throws Exception {
        when(notificacaoEmailService.isDisponivel()).thenReturn(true);

        service.notificarFalhaDefinitiva(
                "0001672-78.2025.5.18.0054",
                PjeGrau.PRIMEIRO_GRAU,
                "Timeout 90000ms exceeded",
                3);

        ArgumentCaptor<String> assunto = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> corpo = ArgumentCaptor.forClass(String.class);
        verify(notificacaoEmailService)
                .enviar(eq(List.of("itamarvillareal@gmail.com")), assunto.capture(), corpo.capture());

        assertThat(assunto.getValue()).contains("0001672-78.2025.5.18.0054");
        assertThat(corpo.getValue()).contains("100.123.21.81:1080");
        assertThat(corpo.getValue()).contains("Cursor");
    }

    @Test
    void notificarFalhaDefinitiva_desativadoNaoEnvia() throws Exception {
        properties.setAtivo(false);
        service.notificarFalhaDefinitiva("cnj", PjeGrau.PRIMEIRO_GRAU, "erro", 3);
        verify(notificacaoEmailService, never()).enviar(any(), any(), any());
    }
}
