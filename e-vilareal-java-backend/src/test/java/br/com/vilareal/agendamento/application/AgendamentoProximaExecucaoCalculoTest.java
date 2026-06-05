package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.domain.PeriodoCadencia;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.common.exception.BusinessRuleException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.LocalDateTime;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AgendamentoProximaExecucaoCalculoTest {

    private static final LocalTime OITO = LocalTime.of(8, 0);

    @Test
    void calcularProxima_horariosFixos_proximoSlotHoje() {
        AgendamentoConsultaEntity a = new AgendamentoConsultaEntity();
        a.setTipoCadencia(TipoCadencia.HORARIOS_FIXOS);
        a.setHorariosFixos("08:00,14:30,18:00");

        LocalDateTime ref = LocalDateTime.of(2026, 6, 4, 10, 0);
        LocalDateTime proxima = AgendamentoProximaExecucaoCalculo.calcularProxima(a, ref);

        assertThat(proxima).isEqualTo(LocalDateTime.of(2026, 6, 4, 14, 30));
    }

    @Test
    void calcularProxima_horariosFixos_primeiroAmanha() {
        AgendamentoConsultaEntity a = new AgendamentoConsultaEntity();
        a.setTipoCadencia(TipoCadencia.HORARIOS_FIXOS);
        a.setHorariosFixos("08:00,14:00");

        LocalDateTime ref = LocalDateTime.of(2026, 6, 4, 20, 0);
        LocalDateTime proxima = AgendamentoProximaExecucaoCalculo.calcularProxima(a, ref);

        assertThat(proxima).isEqualTo(LocalDateTime.of(2026, 6, 5, 8, 0));
    }

    @Test
    void calcularProxima_intervalo_somaMinutos() {
        AgendamentoConsultaEntity a = new AgendamentoConsultaEntity();
        a.setTipoCadencia(TipoCadencia.INTERVALO);
        a.setIntervaloMinutos(120);

        LocalDateTime ref = LocalDateTime.of(2026, 1, 1, 9, 0);
        assertThat(AgendamentoProximaExecucaoCalculo.calcularProxima(a, ref))
                .isEqualTo(LocalDateTime.of(2026, 1, 1, 11, 0));
    }

    @Test
    void semearPeriodico_hojeNoHorarioSeFuturo() {
        LocalDateTime ref = LocalDateTime.of(2026, 6, 4, 7, 30);
        assertThat(AgendamentoProximaExecucaoCalculo.semearPeriodico(ref, PeriodoCadencia.SEMANAL, OITO))
                .isEqualTo(LocalDateTime.of(2026, 6, 4, 8, 0));
    }

    @Test
    void semearPeriodico_proximaOcorrenciaSeHorarioPassou() {
        LocalDateTime ref = LocalDateTime.of(2026, 6, 4, 10, 0);
        assertThat(AgendamentoProximaExecucaoCalculo.semearPeriodico(ref, PeriodoCadencia.SEMANAL, OITO))
                .isEqualTo(LocalDateTime.of(2026, 6, 11, 8, 0));
    }

    @ParameterizedTest
    @EnumSource(PeriodoCadencia.class)
    void avancarPeriodo_cadaPeriodoNoHorarioFixo(PeriodoCadencia periodo) {
        LocalDateTime base = LocalDateTime.of(2026, 1, 15, 8, 0);
        LocalDateTime proxima = AgendamentoProximaExecucaoCalculo.avancarPeriodo(base, periodo, OITO);
        assertThat(proxima.toLocalTime()).isEqualTo(OITO);
        assertThat(proxima).isAfter(base);
    }

    @Test
    void avancarPeriodo_diario_maisUmDia() {
        LocalDateTime base = LocalDateTime.of(2026, 3, 10, 8, 0);
        assertThat(AgendamentoProximaExecucaoCalculo.avancarPeriodo(base, PeriodoCadencia.DIARIO, OITO))
                .isEqualTo(LocalDateTime.of(2026, 3, 11, 8, 0));
    }

    @Test
    void avancarPeriodo_semanal_maisSeteDias() {
        LocalDateTime base = LocalDateTime.of(2026, 3, 10, 8, 0);
        assertThat(AgendamentoProximaExecucaoCalculo.avancarPeriodo(base, PeriodoCadencia.SEMANAL, OITO))
                .isEqualTo(LocalDateTime.of(2026, 3, 17, 8, 0));
    }

    @Test
    void avancarPeriodo_mensal_clampaFimDeMes() {
        LocalDateTime base = LocalDateTime.of(2026, 1, 31, 8, 0);
        assertThat(AgendamentoProximaExecucaoCalculo.avancarPeriodo(base, PeriodoCadencia.MENSAL, OITO))
                .isEqualTo(LocalDateTime.of(2026, 2, 28, 8, 0));
    }

    @Test
    void calcularProximaAposSucesso_periodico_avancaDaProximaAnterior() {
        AgendamentoConsultaEntity a = periodico(PeriodoCadencia.SEMANAL);
        a.setProximaExecucao(LocalDateTime.of(2026, 6, 4, 8, 0));
        LocalDateTime agora = LocalDateTime.of(2026, 6, 4, 8, 5);

        assertThat(AgendamentoProximaExecucaoCalculo.calcularProximaAposSucesso(a, agora))
                .isEqualTo(LocalDateTime.of(2026, 6, 11, 8, 0));
    }

    @Test
    void resumoCadencia_periodico() {
        AgendamentoConsultaEntity a = periodico(PeriodoCadencia.MENSAL);
        assertThat(AgendamentoProximaExecucaoCalculo.resumoCadencia(a)).isEqualTo("mensal às 08:00");
    }

    @Test
    void validarCadencia_periodicoExigePeriodoEHorario() {
        assertThatThrownBy(() -> AgendamentoProximaExecucaoCalculo.validarCadencia(
                        TipoCadencia.PERIODICO, null, null, null, OITO))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("periodo");

        assertThatThrownBy(() -> AgendamentoProximaExecucaoCalculo.validarCadencia(
                        TipoCadencia.PERIODICO, null, null, PeriodoCadencia.DIARIO, null))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("periodoHorario");
    }

    @Test
    void validarCadencia_intervaloExigeMinutos() {
        assertThatThrownBy(() -> AgendamentoProximaExecucaoCalculo.validarCadencia(
                        TipoCadencia.INTERVALO, 0, null, null, null))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("intervaloMinutos");
    }

    private static AgendamentoConsultaEntity periodico(PeriodoCadencia periodo) {
        AgendamentoConsultaEntity a = new AgendamentoConsultaEntity();
        a.setTipoCadencia(TipoCadencia.PERIODICO);
        a.setPeriodo(periodo);
        a.setPeriodoHorario(OITO);
        return a;
    }
}
