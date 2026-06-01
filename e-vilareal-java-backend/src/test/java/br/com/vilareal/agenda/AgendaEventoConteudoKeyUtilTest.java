package br.com.vilareal.agenda;

import br.com.vilareal.agenda.application.AgendaEventoConteudoKeyUtil;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class AgendaEventoConteudoKeyUtilTest {

    @Test
    void chaveUsaHashDaDescricaoNormalizada() {
        LocalDate data = LocalDate.of(2026, 6, 1);
        String key = AgendaEventoConteudoKeyUtil.gerar(1L, data, "09:15", "CONCILIAÇÃO (CLINICA SSMA LTDA)", null);
        String key2 = AgendaEventoConteudoKeyUtil.gerar(1L, data, "09:15", "CONCILIAÇÃO (CLINICA SSMA LTDA)", null);
        assertThat(key).isEqualTo(key2);
        assertThat(key).startsWith("1|2026-06-01|09:15|");
        assertThat(key).endsWith("|");

        String keySemHora = AgendaEventoConteudoKeyUtil.gerar(
                2L, data, null, "  enviar guia  ", "OK");
        assertThat(keySemHora).startsWith("2|2026-06-01||");
        assertThat(keySemHora).endsWith("|OK");
    }

    @Test
    void descricaoVaziaViraCompromisso() {
        String key = AgendaEventoConteudoKeyUtil.gerar(3L, LocalDate.of(2026, 1, 1), "14h00", "  ", null);
        assertThat(key).startsWith("3|2026-01-01|14:00|");
        assertThat(key).endsWith("|");
    }
}
