package br.com.vilareal.email;

import br.com.vilareal.projudi.ProjudiOrquestradorService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProjudiMovimentacoesAcervoIntegralEstadoTest {

    @Test
    void montarFilaDrive_priorizaAtivadosEExcluiCompletos() {
        ProjudiMovimentacoesAcervoIntegralEstado estado = new ProjudiMovimentacoesAcervoIntegralEstado();
        estado.marcarCompleto(1L);
        estado.marcarCompleto(2L);

        List<Long> fila = ProjudiMovimentacoesAcervoIntegralEstado.montarFilaDrive(
                List.of(1L, 2L, 3L), List.of(2L, 4L), estado);

        assertThat(fila).containsExactly(2L, 4L, 3L);
        assertThat(estado.estaCompleto(2L)).isFalse();
    }

    @Test
    void indicaAcervoIntegralCompleto_quandoTemMaisFalseETotaisBatem() {
        var resultado = new ProjudiOrquestradorService.ResultadoSomenteDriveProcesso(
                "cnj", 0, 5, 5, 5, false, 10L, null, List.of(), null);
        assertThat(ProjudiMovimentacoesAcervoIntegralEstado.indicaAcervoIntegralCompleto(resultado))
                .isTrue();
    }

    @Test
    void indicaAcervoIntegralCompleto_falseQuandoTemMaisOuErro() {
        var comMais = new ProjudiOrquestradorService.ResultadoSomenteDriveProcesso(
                "cnj", 1, 3, 5, 4, true, 10L, null, List.of(), null);
        assertThat(ProjudiMovimentacoesAcervoIntegralEstado.indicaAcervoIntegralCompleto(comMais))
                .isFalse();

        var comErro = new ProjudiOrquestradorService.ResultadoSomenteDriveProcesso(
                "cnj", 0, 0, 0, 0, false, 10L, "falha", List.of(), null);
        assertThat(ProjudiMovimentacoesAcervoIntegralEstado.indicaAcervoIntegralCompleto(comErro))
                .isFalse();
    }

    @Test
    void todosElegiveisCompletos() {
        ProjudiMovimentacoesAcervoIntegralEstado estado = new ProjudiMovimentacoesAcervoIntegralEstado();
        estado.marcarCompleto(10L);
        estado.marcarCompleto(20L);
        assertThat(estado.todosElegiveisCompletos(List.of(10L, 20L))).isTrue();
        assertThat(estado.todosElegiveisCompletos(List.of(10L, 30L))).isFalse();
    }
}
