package br.com.vilareal.projudi.application;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ProjudiPeticaoProtocoloLoteServiceTest {

    @Test
    void agruparPorJuntada_mesmoProcessoECredencial_ficaEmUmGrupo() {
        var chaves = Map.of(
                2L, new ProjudiPeticaoProtocoloLoteService.ChaveJuntada(2L, "5487866-77.2022.8.09.0007"),
                3L, new ProjudiPeticaoProtocoloLoteService.ChaveJuntada(2L, "5487866-77.2022.8.09.0007"));

        List<List<Long>> grupos =
                ProjudiPeticaoProtocoloLoteService.agruparPorJuntadaParaTeste(List.of(2L, 3L), chaves::get);

        assertThat(grupos).hasSize(1);
        assertThat(grupos.getFirst()).containsExactly(2L, 3L);
    }

    @Test
    void agruparPorJuntada_processosDistintos_separaGrupos() {
        var chaves = Map.of(
                1L, new ProjudiPeticaoProtocoloLoteService.ChaveJuntada(2L, "111"),
                2L, new ProjudiPeticaoProtocoloLoteService.ChaveJuntada(2L, "222"),
                3L, new ProjudiPeticaoProtocoloLoteService.ChaveJuntada(2L, "111"));

        List<List<Long>> grupos =
                ProjudiPeticaoProtocoloLoteService.agruparPorJuntadaParaTeste(List.of(1L, 2L, 3L), chaves::get);

        assertThat(grupos).hasSize(2);
        assertThat(grupos.get(0)).containsExactly(1L, 3L);
        assertThat(grupos.get(1)).containsExactly(2L);
    }

    @Test
    void agruparPorJuntada_credenciaisDistintas_separaGrupos() {
        var chaves = Map.of(
                10L, new ProjudiPeticaoProtocoloLoteService.ChaveJuntada(1L, "111"),
                11L, new ProjudiPeticaoProtocoloLoteService.ChaveJuntada(2L, "111"));

        List<List<Long>> grupos =
                ProjudiPeticaoProtocoloLoteService.agruparPorJuntadaParaTeste(List.of(10L, 11L), chaves::get);

        assertThat(grupos).hasSize(2);
        assertThat(grupos.get(0)).containsExactly(10L);
        assertThat(grupos.get(1)).containsExactly(11L);
    }
}
