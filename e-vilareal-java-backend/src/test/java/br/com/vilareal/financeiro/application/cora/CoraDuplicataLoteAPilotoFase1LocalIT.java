package br.com.vilareal.financeiro.application.cora;

import br.com.vilareal.acoes.api.dto.AcoesDoDiaResponse;
import br.com.vilareal.acoes.application.AcoesDoDiaApplicationService;
import br.com.vilareal.financeiro.application.FinanceiroApplicationService;
import br.com.vilareal.financeiro.domain.StatusLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.recebivel.api.dto.RecebivelQuadroResponse;
import br.com.vilareal.recebivel.application.RecebivelQuadroApplicationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Piloto Fase 1 — aposenta 10 PL limpos do Lote A (COMMIT real) + teste de undo.
 * Ativar: {@code -Dcora.migration.piloto.fase1=true -Dtest=CoraDuplicataLoteAPilotoFase1LocalIT}
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("dev")
@EnabledIfSystemProperty(named = "cora.migration.piloto.fase1", matches = "true")
class CoraDuplicataLoteAPilotoFase1LocalIT {

    /** 10 pares limpos (sem elo, grupo, classificação divergente) — ver query pré-piloto. */
    private static final List<Long> PILOTO_PL = List.of(
            180503L, 180504L, 180532L, 180537L, 180563L,
            180565L, 180578L, 180583L, 180586L, 180588L);

    private static final List<Long> PILOTO_OFX = List.of(
            219781L, 219773L, 219745L, 219731L, 219714L,
            219713L, 219697L, 219689L, 219687L, 219688L);

    private static final long UNDO_PL = 180503L;

    @Autowired
    private FinanceiroApplicationService financeiroService;

    @Autowired
    private LancamentoFinanceiroRepository lancamentoRepository;

    @Autowired
    private RecebivelQuadroApplicationService recebivelQuadroService;

    @Autowired
    private AcoesDoDiaApplicationService acoesDoDiaService;

    @Test
    void pilotoFase1_aposentarDezLimpos_comUndoAoVivo() {
        BigDecimal saldoAntes = lancamentoRepository.sumSaldoAssinadoPorNumeroBanco(26);
        long ativosAntes = lancamentoRepository.countByNumeroBanco(26);
        long aposentadosAntes =
                lancamentoRepository.countByNumeroBancoAndStatus(26, StatusLancamento.APOSENTADO);

        String recebiveisAntes = fingerprintRecebiveis(recebivelQuadroService.quadro(null, null, null));
        String acoesAntes = fingerprintAcoes(acoesDoDiaService.obter(null));

        BigDecimal liquidoPiloto = somaAssinadaPl(PILOTO_PL);

        System.out.println("=== PILOTO FASE 1 — 10 pares limpos ===");
        for (int i = 0; i < PILOTO_PL.size(); i++) {
            var pl = lancamentoRepository.findById(PILOTO_PL.get(i)).orElseThrow();
            System.out.printf(
                    "  PL#%d -> OFX#%d | %s | %s | %s%n",
                    PILOTO_PL.get(i),
                    PILOTO_OFX.get(i),
                    pl.getDataLancamento(),
                    pl.getValor(),
                    pl.getNatureza());
        }

        int aposentados = financeiroService.aposentarLancamentos(PILOTO_PL, "DUP_PLANILHA_OFX");
        assertThat(aposentados).isEqualTo(10);

        BigDecimal saldoDepois = lancamentoRepository.sumSaldoAssinadoPorNumeroBanco(26);
        long ativosDepois = lancamentoRepository.countByNumeroBanco(26);
        long aposentadosDepois =
                lancamentoRepository.countByNumeroBancoAndStatus(26, StatusLancamento.APOSENTADO);

        assertThat(ativosDepois).isEqualTo(ativosAntes - 10);
        assertThat(aposentadosDepois).isEqualTo(aposentadosAntes + 10);
        assertThat(saldoDepois).isEqualByComparingTo(saldoAntes.subtract(liquidoPiloto));

        for (Long plId : PILOTO_PL) {
            assertThat(lancamentoRepository.findById(plId).orElseThrow().getStatus())
                    .isEqualTo(StatusLancamento.APOSENTADO);
        }
        for (Long oxId : PILOTO_OFX) {
            assertThat(lancamentoRepository.findById(oxId).orElseThrow().getStatus())
                    .isEqualTo(StatusLancamento.ATIVO);
        }

        String recebiveisDepois = fingerprintRecebiveis(recebivelQuadroService.quadro(null, null, null));
        String acoesDepois = fingerprintAcoes(acoesDoDiaService.obter(null));
        assertThat(recebiveisDepois).isEqualTo(recebiveisAntes);
        assertThat(acoesDepois).isEqualTo(acoesAntes);

        System.out.println("=== PÓS-APOSENTAR (COMMIT) ===");
        System.out.println("Extrato ATIVO: " + ativosAntes + " -> " + ativosDepois);
        System.out.println("APOSENTADO Cora: " + aposentadosAntes + " -> " + aposentadosDepois);
        System.out.println("Saldo: " + saldoAntes + " -> " + saldoDepois + " (delta esperado " + liquidoPiloto.negate() + ")");
        System.out.println("Recebíveis fingerprint: " + recebiveisAntes + " (inalterado)");
        System.out.println("Ações-do-dia fingerprint: " + acoesAntes + " (inalterado)");

        int reativados = financeiroService.reativarLancamentos(List.of(UNDO_PL));
        assertThat(reativados).isEqualTo(1);
        assertThat(lancamentoRepository.findById(UNDO_PL).orElseThrow().getStatus())
                .isEqualTo(StatusLancamento.ATIVO);
        assertThat(lancamentoRepository.countByNumeroBanco(26)).isEqualTo(ativosDepois + 1);
        System.out.println("=== UNDO PL#" + UNDO_PL + " — reativado, visível no extrato ===");

        int reaposentado = financeiroService.aposentarLancamentos(List.of(UNDO_PL), "DUP_PLANILHA_OFX");
        assertThat(reaposentado).isEqualTo(1);
        assertThat(lancamentoRepository.findById(UNDO_PL).orElseThrow().getStatus())
                .isEqualTo(StatusLancamento.APOSENTADO);
        assertThat(lancamentoRepository.countByNumeroBanco(26)).isEqualTo(ativosDepois);
        System.out.println("=== RE-APOSENTAR PL#" + UNDO_PL + " — estado final piloto OK ===");
    }

    private BigDecimal somaAssinadaPl(List<Long> ids) {
        return lancamentoRepository.findAllByIdIn(Set.copyOf(ids)).stream()
                .map(l -> l.getNatureza().name().equals("CREDITO") ? l.getValor() : l.getValor().negate())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static String fingerprintRecebiveis(RecebivelQuadroResponse r) {
        return r.totalGeral()
                + "|"
                + r.totalVencido()
                + "|"
                + r.itens().size()
                + "|"
                + r.resumoPorTipo().stream()
                        .map(t -> t.tipo() + ":" + t.total())
                        .sorted()
                        .collect(Collectors.joining(","));
    }

    private static String fingerprintAcoes(AcoesDoDiaResponse r) {
        return r.competencia()
                + "|c="
                + r.conciliar().quantidade()
                + "|b="
                + r.cobrar().quantidade()
                + "|r="
                + r.repassar().quantidade()
                + "|n="
                + r.renegociar().quantidade()
                + "|t="
                + r.conciliar().total()
                + ":"
                + r.cobrar().total()
                + ":"
                + r.repassar().total()
                + ":"
                + r.renegociar().total();
    }
}
