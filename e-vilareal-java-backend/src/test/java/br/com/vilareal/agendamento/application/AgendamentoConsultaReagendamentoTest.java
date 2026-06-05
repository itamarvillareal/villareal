package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.domain.PeriodoCadencia;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;

class AgendamentoConsultaReagendamentoTest {

    private static final LocalDateTime AGORA = LocalDateTime.of(2026, 6, 5, 9, 0);

    @Test
    void calcularProximaRetry_cresceComFalhasERespeitaTeto() {
        assertThat(AgendamentoConsultaReagendamento.calcularProximaRetry(AGORA, 1, 10, 60))
                .isEqualTo(AGORA.plusMinutes(10));
        assertThat(AgendamentoConsultaReagendamento.calcularProximaRetry(AGORA, 2, 10, 60))
                .isEqualTo(AGORA.plusMinutes(20));
        assertThat(AgendamentoConsultaReagendamento.calcularProximaRetry(AGORA, 6, 10, 60))
                .isEqualTo(AGORA.plusMinutes(60));
        assertThat(AgendamentoConsultaReagendamento.calcularProximaRetry(AGORA, 10, 10, 60))
                .isEqualTo(AGORA.plusMinutes(60));
    }

    @Test
    void aplicarSucesso_zeraFalhasEUsaCadencia() {
        AgendamentoConsultaEntity ag = agendamentoIntervalo(60);
        ag.setFalhasConsecutivas(3);
        ag.setUltimoErro("erro antigo");
        ag.setUltimaFalhaEm(AGORA.minusHours(1));

        AgendamentoConsultaReagendamento.aplicarSucesso(ag, AGORA);

        assertThat(ag.getUltimaExecucao()).isEqualTo(AGORA);
        assertThat(ag.getProximaExecucao()).isEqualTo(AGORA.plusMinutes(60));
        assertThat(ag.getFalhasConsecutivas()).isZero();
        assertThat(ag.getUltimoErro()).isNull();
        assertThat(ag.getUltimaFalhaEm()).isNull();
    }

    @Test
    void aplicarSucesso_periodico_avancaDaProximaAgendada() {
        AgendamentoConsultaEntity ag = new AgendamentoConsultaEntity();
        ag.setTipoCadencia(TipoCadencia.PERIODICO);
        ag.setPeriodo(PeriodoCadencia.SEMANAL);
        ag.setPeriodoHorario(LocalTime.of(8, 0));
        ag.setProximaExecucao(LocalDateTime.of(2026, 6, 4, 8, 0));

        AgendamentoConsultaReagendamento.aplicarSucesso(ag, LocalDateTime.of(2026, 6, 4, 8, 2));

        assertThat(ag.getProximaExecucao()).isEqualTo(LocalDateTime.of(2026, 6, 11, 8, 0));
    }

    @Test
    void aplicarFalha_incrementaContadorEBackoffSemCadencia() {
        AgendamentoConsultaEntity ag = agendamentoIntervalo(60);

        AgendamentoConsultaReagendamento.aplicarFalha(ag, AGORA, "Token OTP", 10, 60);

        assertThat(ag.getUltimaExecucao()).isEqualTo(AGORA);
        assertThat(ag.getProximaExecucao()).isEqualTo(AGORA.plusMinutes(10));
        assertThat(ag.getFalhasConsecutivas()).isEqualTo(1);
        assertThat(ag.getUltimoErro()).isEqualTo("Token OTP");
        assertThat(ag.getUltimaFalhaEm()).isEqualTo(AGORA);
    }

    private static AgendamentoConsultaEntity agendamentoIntervalo(int minutos) {
        AgendamentoConsultaEntity ag = new AgendamentoConsultaEntity();
        ag.setTipoCadencia(TipoCadencia.INTERVALO);
        ag.setIntervaloMinutos(minutos);
        ag.setAtivo(true);
        ag.setFalhasConsecutivas(0);
        return ag;
    }
}
