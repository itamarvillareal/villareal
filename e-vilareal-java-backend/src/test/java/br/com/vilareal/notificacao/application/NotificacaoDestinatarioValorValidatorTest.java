package br.com.vilareal.notificacao.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NotificacaoDestinatarioValorValidatorTest {

    @Test
    void normalizarWhatsapp_aceitaE164() {
        assertThat(NotificacaoDestinatarioValorValidator.normalizarWhatsapp("+55 62 98876-5432"))
                .isEqualTo("+5562988765432");
    }

    @Test
    void normalizarEmail_lowercase() {
        assertThat(NotificacaoDestinatarioValorValidator.normalizarEmail("  Escritorio@VilaReal.COM "))
                .isEqualTo("escritorio@vilareal.com");
    }

    @Test
    void normalizarEmail_invalido() {
        assertThatThrownBy(() -> NotificacaoDestinatarioValorValidator.normalizarEmail("nao-email"))
                .isInstanceOf(BusinessRuleException.class);
    }
}
