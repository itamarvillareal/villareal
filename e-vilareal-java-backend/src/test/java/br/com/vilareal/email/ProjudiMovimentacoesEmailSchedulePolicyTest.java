package br.com.vilareal.email;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class ProjudiMovimentacoesEmailSchedulePolicyTest {

    private static final ZoneId SP = ZoneId.of("America/Sao_Paulo");

    @Test
    void classificar_terca14h_comercial() {
        ZonedDateTime t = ZonedDateTime.of(2026, 6, 2, 14, 0, 0, 0, SP);
        assertThat(ProjudiMovimentacoesEmailSchedulePolicy.classificar(t))
                .isEqualTo(ProjudiMovimentacoesEmailSchedulePolicy.PerfilNome.COMERCIAL);
    }

    @Test
    void classificar_sex23h_noturno() {
        ZonedDateTime t = ZonedDateTime.of(2026, 6, 5, 23, 0, 0, 0, SP);
        assertThat(ProjudiMovimentacoesEmailSchedulePolicy.classificar(t))
                .isEqualTo(ProjudiMovimentacoesEmailSchedulePolicy.PerfilNome.NOTURNO);
    }

    @Test
    void classificar_sab10h_fimDeSemana() {
        ZonedDateTime t = ZonedDateTime.of(2026, 6, 6, 10, 0, 0, 0, SP);
        assertThat(ProjudiMovimentacoesEmailSchedulePolicy.classificar(t))
                .isEqualTo(ProjudiMovimentacoesEmailSchedulePolicy.PerfilNome.FIM_DE_SEMANA);
    }

    @Test
    void classificar_seg05h_noturno() {
        ZonedDateTime t = ZonedDateTime.of(2026, 6, 1, 5, 30, 0, 0, SP);
        assertThat(ProjudiMovimentacoesEmailSchedulePolicy.classificar(t))
                .isEqualTo(ProjudiMovimentacoesEmailSchedulePolicy.PerfilNome.NOTURNO);
    }

    @Test
    void resolverPerfilAtual_usaConfigComercial() {
        ProjudiMovimentacoesEmailPipelineProperties props = new ProjudiMovimentacoesEmailPipelineProperties();
        props.getComercial().setIntervaloMinutos(15);
        props.getComercial().setDelaySegundosEntreProcessos(60);
        props.getComercial().setMaxProcessosPorCiclo(20);

        Clock clock = Clock.fixed(Instant.parse("2026-06-02T17:00:00Z"), SP);
        ProjudiMovimentacoesEmailSchedulePolicy policy = new ProjudiMovimentacoesEmailSchedulePolicy(props, clock);

        ProjudiMovimentacoesEmailSchedulePolicy.PerfilAtivo perfil = policy.resolverPerfilAtual();
        assertThat(perfil.nome()).isEqualTo(ProjudiMovimentacoesEmailSchedulePolicy.PerfilNome.COMERCIAL);
        assertThat(perfil.intervaloMinutos()).isEqualTo(15);
        assertThat(perfil.delaySegundosEntreProcessos()).isEqualTo(60);
        assertThat(perfil.maxProcessosPorCiclo()).isEqualTo(20);
    }
}
