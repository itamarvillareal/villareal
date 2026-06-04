package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.application.DebitoNovo;
import br.com.vilareal.calculo.application.ResultadoMerge;
import br.com.vilareal.condominio.api.dto.CobrancaProcessarErroDto;
import br.com.vilareal.condominio.api.dto.CobrancaUnidadeRequestDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import br.com.vilareal.condominio.api.dto.RelatorioExecucaoCobranca;
import br.com.vilareal.condominio.api.dto.RelatorioRegraInicioDto;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CobrancaRelatorioMontadorTest {

    private final CobrancaRelatorioMontador montador = new CobrancaRelatorioMontador();

    @Test
    void montar_inseridoIgnoradoErro_reconciliacaoFechaEPontosAtencao() {
        CobrancaUnidadeRequestDto uOk = unidade("A-0402", "Maria", "12345678901", List.of(
                cob("10/04/2026", 10_000L),
                cob("11/05/2026", 20_000L)));
        CobrancaUnidadeRequestDto uErro = unidade("B-9999", "João", "98765432100", List.of(
                cob("01/06/2026", 5_000L),
                cob("02/07/2026", 6_000L)));

        ResultadoMerge merge = new ResultadoMerge(
                List.of(new ResultadoMerge.DimensaoTocada(
                        0,
                        false,
                        List.of(new ResultadoMerge.InsercaoDebito(
                                0, 1, new DebitoNovo("10/04/2026", 10_000L, "Taxa"))))),
                List.of(ResultadoMerge.DebitoIgnorado.of(new DebitoNovo("11/05/2026", 20_000L, "Extra"), 0)));

        UnidadeProcessamentoResult sucesso = new UnidadeProcessamentoResult(
                uOk,
                new ResolucaoUnidade(1L, false, null, 100L, 3, false, false, false, null),
                merge);

        RelatorioExecucaoCobranca r = montador.montar(
                "imp-test",
                Instant.parse("2026-06-03T10:19:38Z"),
                "00000299",
                "Condomínio Teste",
                "inadimplencia.xls",
                "admin",
                List.of(uOk, uErro),
                new RelatorioRegraInicioDto("D+1", "2026-06-03", 0, 0),
                List.of(sucesso),
                List.of(new CobrancaProcessarErroDto("B-9999", "Falha simulada")));

        assertThat(r.totaisDocumento().titulos()).isEqualTo(4);
        assertThat(r.totaisExecucao().titulosInseridos()).isEqualTo(1);
        assertThat(r.totaisExecucao().titulosIgnorados()).isEqualTo(1);
        assertThat(r.totaisExecucao().titulosFalhados()).isEqualTo(2);
        assertThat(CobrancaRelatorioMontador.reconciliacaoFecha(r.totaisDocumento(), r.totaisExecucao()))
                .isTrue();

        assertThat(r.pontosAtencao()).anyMatch(p -> p.contains("falharam"));
        assertThat(r.pontosAtencao()).noneMatch(p -> p.startsWith("DIVERGÊNCIA"));

        assertThat(r.itens()).hasSize(1);
        assertThat(r.itens().getFirst().debitosInseridos()).isEqualTo(1);
        assertThat(r.itens().getFirst().debitosIgnorados()).isEqualTo(1);
        assertThat(r.itens().getFirst().inseridos()).hasSize(1);
        assertThat(r.itens().getFirst().ignorados()).hasSize(1);
        assertThat(r.itens().getFirst().ignorados().getFirst().motivo())
                .isEqualTo(ResultadoMerge.MOTIVO_DEBITO_JA_EXISTE);
        assertThat(r.itens().getFirst().ignorados().getFirst().dimensaoExistente()).isZero();
    }

    @Test
    void montar_divergencia_geraPontoAtencao() {
        RelatorioExecucaoCobranca r = montador.montar(
                "x",
                Instant.now(),
                "00000299",
                "C",
                null,
                null,
                List.of(unidade("A-01", "X", "12345678901", List.of(cob("10/10/2026", 100L)))),
                new RelatorioRegraInicioDto("D+1", "2026-06-03", 0, 0),
                List.of(),
                List.of());

        assertThat(r.pontosAtencao()).anyMatch(p -> p.contains("DIVERGÊNCIA"));
        assertThat(CobrancaRelatorioMontador.reconciliacaoFecha(r.totaisDocumento(), r.totaisExecucao()))
                .isFalse();
    }

    private static CobrancaUnidadeRequestDto unidade(
            String cod, String nome, String doc, List<InadimplenciaCobrancaDto> cobrancas) {
        return new CobrancaUnidadeRequestDto(cod, nome, doc, cobrancas);
    }

    private static InadimplenciaCobrancaDto cob(String venc, long centavos) {
        return new InadimplenciaCobrancaDto("Ordinária", "1", "04/2026", venc, "100,00", centavos, "");
    }

    @Test
    void montar_comDevedoresDescartados_pontoAtencaoRegraD() {
        RelatorioExecucaoCobranca r = montador.montar(
                "x",
                Instant.now(),
                "00000299",
                "C",
                null,
                null,
                List.of(),
                new RelatorioRegraInicioDto("D+60", "2026-06-03", 1, 1),
                List.of(),
                List.of());

        assertThat(r.regraInicio().regraAplicada()).isEqualTo("D+60");
        assertThat(r.regraInicio().devedoresDescartados()).isEqualTo(1);
        assertThat(r.pontosAtencao())
                .anyMatch(p -> p.contains("não atingiram a regra D+60") && p.contains("descartados"));
    }
}
