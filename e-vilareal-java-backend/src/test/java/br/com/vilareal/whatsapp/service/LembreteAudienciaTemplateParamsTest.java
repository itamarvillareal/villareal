package br.com.vilareal.whatsapp.service;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LembreteAudienciaTemplateParamsTest {

    @Test
    void montar_incluiClienteEParteAutoraNoParamProcesso() {
        Instant audiencia =
                ZonedDateTime.of(2026, 7, 10, 15, 0, 0, 0, ZoneId.of("America/Sao_Paulo")).toInstant();

        List<String> params = LembreteAudienciaTemplateParams.montar(
                "Maria",
                "5009686-73.2026.8.09.0007",
                "Condomínio Solar",
                "João da Silva",
                audiencia);

        assertThat(params).hasSize(3);
        assertThat(params.get(0)).isEqualTo("Maria");
        assertThat(params.get(1))
                .isEqualTo(
                        "5009686-73.2026.8.09.0007 — Cliente: Condomínio Solar; Parte autora: João da Silva");
        assertThat(params.get(2)).isEqualTo("10/07/2026 às 15:00");
    }

    @Test
    void montar_comLink_incluiQuartaVariavel() {
        Instant audiencia =
                ZonedDateTime.of(2026, 7, 10, 15, 0, 0, 0, ZoneId.of("America/Sao_Paulo")).toInstant();

        List<String> params = LembreteAudienciaTemplateParams.montar(
                "Maria",
                "5009686-73.2026.8.09.0007",
                "Condomínio Solar",
                "João da Silva",
                audiencia,
                "https://meet.google.com/abc-defg-hij");

        assertThat(params).hasSize(4);
        assertThat(params.get(3)).isEqualTo("https://meet.google.com/abc-defg-hij");
        assertThat(LembreteAudienciaTemplateParams.resolverNomeTemplate("https://meet.google.com/x"))
                .isEqualTo(LembreteAudienciaTemplateParams.TEMPLATE_COM_LINK);
    }

    @Test
    void formatParamProcesso_usaTracoQuandoVazio() {
        assertThat(LembreteAudienciaTemplateParams.formatParamProcesso("123", "", null))
                .isEqualTo("123 — Cliente: —; Parte autora: —");
    }
}
