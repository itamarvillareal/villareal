package br.com.vilareal.email;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ProjudiMovimentacoesEmailPipelineServiceTest {

    @Test
    void calcularAguardarMs_cicloCurto_esperaRestante() {
        Instant inicio = Instant.now().minusSeconds(120);
        long aguardar = ProjudiMovimentacoesEmailPipelineService.calcularAguardarMs(inicio, 10);
        assertThat(aguardar).isBetween(480_000L, 490_000L);
    }

    @Test
    void calcularAguardarMs_cicloLongo_retornaZero() {
        Instant inicio = Instant.now().minusSeconds(900);
        long aguardar = ProjudiMovimentacoesEmailPipelineService.calcularAguardarMs(inicio, 10);
        assertThat(aguardar).isZero();
    }
}
