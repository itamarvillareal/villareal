package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import java.net.CookieManager;
import java.net.http.HttpClient;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

class ProjudiSessionAtividadeTest {

    @Test
    void sessaoValidaPorAtividade_renovaJanelaComUltimaAtividadeRecente() {
        Instant login = Instant.now().minus(30, ChronoUnit.MINUTES);
        Instant atividade = Instant.now().minus(2, ChronoUnit.MINUTES);
        ProjudiSessionService.ProjudiSession sessao = new ProjudiSessionService.ProjudiSession(
                HttpClient.newHttpClient(),
                new CookieManager(),
                login,
                atividade,
                "00733235190",
                false);

        assertThat(ProjudiSessionService.sessaoValidaPorAtividade(sessao, 25)).isTrue();
    }

    @Test
    void sessaoValidaPorAtividade_expiraPorInatividadeMesmoComLoginAntigo() {
        Instant login = Instant.now().minus(10, ChronoUnit.MINUTES);
        Instant atividade = Instant.now().minus(26, ChronoUnit.MINUTES);
        ProjudiSessionService.ProjudiSession sessao = new ProjudiSessionService.ProjudiSession(
                HttpClient.newHttpClient(),
                new CookieManager(),
                login,
                atividade,
                "00733235190",
                false);

        assertThat(ProjudiSessionService.sessaoValidaPorAtividade(sessao, 25)).isFalse();
    }

    @Test
    void sessaoValidaPorAtividade_usaAutenticadoEmQuandoUltimaAtividadeAusente() {
        Instant login = Instant.now().minus(5, ChronoUnit.MINUTES);
        ProjudiSessionService.ProjudiSession sessao = new ProjudiSessionService.ProjudiSession(
                HttpClient.newHttpClient(),
                new CookieManager(),
                login,
                null,
                "00733235190",
                true);

        assertThat(ProjudiSessionService.sessaoValidaPorAtividade(sessao, 25)).isTrue();
    }
}
