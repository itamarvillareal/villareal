package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.configuracao.application.SistemaConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppIAConfigServiceTest {

    @Mock
    private SistemaConfigService sistemaConfigService;

    private WhatsAppConfig whatsAppConfig;
    private WhatsAppIAConfigService service;

    @BeforeEach
    void setUp() {
        whatsAppConfig = new WhatsAppConfig();
        whatsAppConfig.setIaEnabled(true);
        service = new WhatsAppIAConfigService(sistemaConfigService, whatsAppConfig);
    }

    @Test
    void isIaHabilitada_usaValorDoBancoQuandoPresente() {
        when(sistemaConfigService.obterValor(WhatsAppIAConfigService.CHAVE_SISTEMA)).thenReturn(Optional.of("false"));

        assertThat(service.isIaHabilitada()).isFalse();
    }

    @Test
    void isIaHabilitada_usaPropriedadeQuandoBancoVazio() {
        when(sistemaConfigService.obterValor(WhatsAppIAConfigService.CHAVE_SISTEMA)).thenReturn(Optional.empty());
        whatsAppConfig.setIaEnabled(false);

        assertThat(service.isIaHabilitada()).isFalse();
    }

    @Test
    void salvarIaHabilitada_persisteNoSistemaConfig() {
        assertThat(service.salvarIaHabilitada(false)).isFalse();

        ArgumentCaptor<String> valor = ArgumentCaptor.forClass(String.class);
        verify(sistemaConfigService).salvarValor(org.mockito.ArgumentMatchers.eq(WhatsAppIAConfigService.CHAVE_SISTEMA), valor.capture());
        assertThat(valor.getValue()).isEqualTo("false");
    }
}
