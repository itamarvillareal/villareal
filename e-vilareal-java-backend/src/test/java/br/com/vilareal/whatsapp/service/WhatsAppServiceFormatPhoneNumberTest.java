package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.util.TelefoneBrasilUtil;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WhatsAppServiceFormatPhoneNumberTest {

    @Test
    void formatPhoneNumber_delegaParaTelefoneBrasilUtil() {
        String input = "556292975894";
        assertThat(WhatsAppService.formatPhoneNumber(input)).isEqualTo(TelefoneBrasilUtil.canonicalizar(input));
    }

    @Test
    void formatPhoneNumber_celularSem9_ganhaNonoDigito() {
        assertThat(WhatsAppService.formatPhoneNumber("556292975894")).isEqualTo("5562992975894");
    }

    @Test
    void formatPhoneNumber_celularCom9_inalterado() {
        assertThat(WhatsAppService.formatPhoneNumber("5562992975894")).isEqualTo("5562992975894");
    }

    @Test
    void formatPhoneNumber_fixo_inalterado() {
        assertThat(WhatsAppService.formatPhoneNumber("556232179999")).isEqualTo("556232179999");
    }

    @Test
    void formatPhoneNumber_comMascara() {
        assertThat(WhatsAppService.formatPhoneNumber("5562 9 8234-5000")).isEqualTo("5562982345000");
    }

    @Test
    void formatPhoneNumber_invalido_lancaExcecao() {
        assertThatThrownBy(() -> WhatsAppService.formatPhoneNumber("123"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
