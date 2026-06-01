package br.com.vilareal.agenda;

import br.com.vilareal.agenda.application.AgendaEventoEquivalenciaUtil;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AgendaEventoEquivalenciaUtilTest {

    @Test
    void prefixoEquivalenteQuandoProcessoRefAusenteEmAmbos() {
        boolean ok = AgendaEventoEquivalenciaUtil.equivalentesCampos(
                "09:15",
                "CONCILIAÇÃO (CLINICA SSMA LTDA) de RIO VERDE",
                null,
                null,
                "09:15",
                "CONCILIAÇÃO (CLINICA SSMA LTDA)",
                null,
                null);
        assertThat(ok).isTrue();
    }

    @Test
    void naoFundeQuandoProcessoRefDiferente() {
        boolean ok = AgendaEventoEquivalenciaUtil.equivalentesCampos(
                "09:15",
                "AUDIÊNCIA TRABALHISTA",
                null,
                "111",
                "09:15",
                "AUDIÊNCIA TRABALHISTA",
                null,
                "222");
        assertThat(ok).isFalse();
    }

    @Test
    void naoFundeQuandoSoUmTemProcessoRef() {
        boolean ok = AgendaEventoEquivalenciaUtil.equivalentesCampos(
                "09:15",
                "AUDIÊNCIA TRABALHISTA",
                null,
                "111",
                "09:15",
                "AUDIÊNCIA TRABALHISTA",
                null,
                null);
        assertThat(ok).isFalse();
    }

    @Test
    void fundeQuandoMesmoProcessoRefEPrefixo() {
        boolean ok = AgendaEventoEquivalenciaUtil.equivalentesCampos(
                "09:15",
                "CONCILIAÇÃO (CLINICA SSMA LTDA) de RIO VERDE",
                null,
                "PROC-1",
                "09:15",
                "CONCILIAÇÃO (CLINICA SSMA LTDA)",
                null,
                "PROC-1");
        assertThat(ok).isTrue();
    }
}
