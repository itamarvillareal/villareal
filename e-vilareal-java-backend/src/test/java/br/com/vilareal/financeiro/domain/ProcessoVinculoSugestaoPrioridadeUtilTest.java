package br.com.vilareal.financeiro.domain;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ProcessoVinculoSugestaoPrioridadeUtilTest {

    @Test
    void indexarLinhasAtividade_unificaLinhasDoMesmoProcesso() {
        List<Object[]> rows = List.of(
                new Object[] {10L, LocalDate.of(2024, 1, 1), 2L},
                new Object[] {10L, LocalDate.of(2026, 3, 15), 1L});

        Map<Long, ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso> map =
                ProcessoVinculoSugestaoPrioridadeUtil.indexarLinhasAtividade(rows);

        assertThat(map.get(10L).ultimaData()).isEqualTo(LocalDate.of(2026, 3, 15));
        assertThat(map.get(10L).quantidade()).isEqualTo(3L);
    }

    @Test
    void comparadorProcessoIds_priorizaUltimaDataMaisRecente() {
        Map<Long, ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso> atividade = Map.of(
                1L, new ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso(LocalDate.of(2020, 1, 1), 5L),
                4L, new ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso(LocalDate.of(2025, 6, 10), 1L));

        var cmp = ProcessoVinculoSugestaoPrioridadeUtil.comparadorProcessoIds(atividade);
        assertThat(cmp.compare(1L, 4L)).isPositive();
        assertThat(cmp.compare(4L, 1L)).isNegative();
    }

    @Test
    void comparadorProcessos_desempataPorQuantidadeNumeroInternoEId() {
        ProcessoEntity p1 = processo(1L, 1);
        ProcessoEntity p2 = processo(2L, 2);
        LocalDate data = LocalDate.of(2025, 1, 1);
        Map<Long, ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso> atividade = Map.of(
                1L, new ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso(data, 1L),
                2L, new ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso(data, 3L));

        List<ProcessoEntity> lista = new ArrayList<>(List.of(p1, p2));
        lista.sort(ProcessoVinculoSugestaoPrioridadeUtil.comparadorProcessos(atividade));

        assertThat(lista.get(0).getId()).isEqualTo(2L);
    }

    @Test
    void confiancaPrincipalPessoaProcesso_altaQuandoAtividadeRecente() {
        LocalDate hoje = LocalDate.of(2026, 6, 18);
        var recente = new ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso(LocalDate.of(2025, 1, 1), 1L);
        var antiga = new ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso(LocalDate.of(2020, 1, 1), 10L);

        assertThat(ProcessoVinculoSugestaoPrioridadeUtil.confiancaPrincipalPessoaProcesso(recente, hoje))
                .isEqualTo(ConfiancaSugestao.ALTA);
        assertThat(ProcessoVinculoSugestaoPrioridadeUtil.confiancaPrincipalPessoaProcesso(antiga, hoje))
                .isEqualTo(ConfiancaSugestao.MEDIA);
    }

    @Test
    void sufixoAtividadeRegra_incluiUltimaData() {
        var act = new ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso(LocalDate.of(2025, 6, 10), 2L);
        assertThat(ProcessoVinculoSugestaoPrioridadeUtil.sufixoAtividadeRegra(act))
                .isEqualTo(" · últ. lanç. 2025-06-10");
    }

    private static ProcessoEntity processo(long id, int numeroInterno) {
        ProcessoEntity p = new ProcessoEntity();
        p.setId(id);
        p.setNumeroInterno(numeroInterno);
        return p;
    }
}
