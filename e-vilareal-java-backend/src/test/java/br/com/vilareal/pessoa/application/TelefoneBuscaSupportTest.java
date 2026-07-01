package br.com.vilareal.pessoa.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TelefoneBuscaSupportTest {

    @Test
    void normalizar_extraiDigitos() {
        assertThat(TelefoneBuscaSupport.normalizar("(62) 99325-4445")).isEqualTo("62993254445");
    }

    @Test
    void normalizar_rejeitaCurto() {
        assertThat(TelefoneBuscaSupport.normalizar("629")).isNull();
    }

    @Test
    void variantes_insereNonoDigitoQuandoBuscaSemNove() {
        assertThat(TelefoneBuscaSupport.variantes("6292682445"))
                .contains("6292682445", "62992682445");
    }

    @Test
    void variantes_removeNonoDigitoQuandoBuscaComNove() {
        assertThat(TelefoneBuscaSupport.variantes("62992682445"))
                .contains("62992682445", "6292682445");
    }

    @Test
    void sufixoLocal_ultimosOitoDigitos() {
        assertThat(TelefoneBuscaSupport.sufixoLocal("6292682445")).isEqualTo("92682445");
        assertThat(TelefoneBuscaSupport.sufixoLocal("62992682445")).isEqualTo("92682445");
    }
}
