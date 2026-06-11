package br.com.vilareal.processo.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProcessoTramitacaoBackfillServiceTest {

    @Test
    void resolverAlvoBackfill_precedenciaProjudiSobreTrt() {
        assertThat(ProcessoTramitacaoBackfillService.resolverAlvoBackfill(
                        1L, "0012345-67.2024.5.18.0001", true, true, false, null))
                .isEqualTo(ProcessoTramitacaoService.TRAMITACAO_PROJUDI);
    }

    @Test
    void resolverAlvoBackfill_trt18SemProjudi() {
        assertThat(ProcessoTramitacaoBackfillService.resolverAlvoBackfill(
                        1L, "0012345-67.2024.5.18.0001", false, true, false, null))
                .isEqualTo(ProcessoTramitacaoService.TRAMITACAO_PJE);
    }

    @Test
    void resolverAlvoBackfill_monitoramentoTjgo() {
        assertThat(ProcessoTramitacaoBackfillService.resolverAlvoBackfill(
                        1L, "5059346-36.2026.8.09.0007", false, false, true, null))
                .isEqualTo(ProcessoTramitacaoService.TRAMITACAO_PROJUDI);
    }

    @Test
    void resolverAlvoBackfill_monitoramentoTrt18PorPublicacao() {
        assertThat(ProcessoTramitacaoBackfillService.resolverAlvoBackfill(
                        1L, null, false, false, true, "0012345-67.2024.5.18.0001"))
                .isEqualTo(ProcessoTramitacaoService.TRAMITACAO_PJE);
    }

    @Test
    void resolverAlvoBackfill_semEvidencia_retornaNull() {
        assertThat(ProcessoTramitacaoBackfillService.resolverAlvoBackfill(
                        1L, "0000000-00.2024.8.26.0001", false, false, true, null))
                .isNull();
    }
}
