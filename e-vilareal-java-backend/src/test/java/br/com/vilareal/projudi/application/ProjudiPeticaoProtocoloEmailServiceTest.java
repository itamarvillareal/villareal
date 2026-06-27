package br.com.vilareal.projudi.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProjudiPeticaoProtocoloEmailServiceTest {

    @Test
    void rotuloParteOposta_alinhaComTelaPeticionamento() {
        assertThat(ProjudiPeticaoProtocoloEmailService.rotuloParteOposta("REQUERIDO")).isEqualTo("Autora");
        assertThat(ProjudiPeticaoProtocoloEmailService.rotuloParteOposta("REQUERENTE")).isEqualTo("Ré");
        assertThat(ProjudiPeticaoProtocoloEmailService.rotuloParteOposta(null)).isEqualTo("Parte oposta");
    }
}
