package br.com.vilareal.documento;

import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosParcelaEntity;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ContratoHonorariosRecebiveisConciliacaoServiceTest {

    @Test
    void scorePagamentoParcela_origemContratoEValorExato_pontuaAlto() {
        ContratoHonorariosEntity contrato = new ContratoHonorariosEntity();
        contrato.setId(9L);

        ContratoHonorariosParcelaEntity parcela = new ContratoHonorariosParcelaEntity();
        parcela.setNumeroParcela(1);
        parcela.setValor(new BigDecimal("1500.00"));
        parcela.setDataVencimento(LocalDate.of(2026, 1, 10));

        PagamentoEntity pag = new PagamentoEntity();
        pag.setValor(new BigDecimal("1500.00"));
        pag.setDataVencimento(LocalDate.of(2026, 1, 10));
        pag.setOrigem("CONTRATO_HONORARIOS:9");
        pag.setDescricao("Honorários contratuais — contrato #9 — parcela 1/3");
        pag.setRecorrenciaParcelaAtual(1);
        pag.setStatus(PagamentoDominio.ST_EMITIDO);

        int score = ContratoHonorariosRecebiveisConciliacaoService.scorePagamentoParcela(contrato, parcela, pag);
        assertThat(score).isGreaterThanOrEqualTo(10);
    }

    @Test
    void scorePagamentoParcela_valorForaTolerancia_retornaZero() {
        ContratoHonorariosEntity contrato = new ContratoHonorariosEntity();
        contrato.setId(1L);
        ContratoHonorariosParcelaEntity parcela = new ContratoHonorariosParcelaEntity();
        parcela.setValor(new BigDecimal("100.00"));
        parcela.setDataVencimento(LocalDate.of(2026, 1, 1));

        PagamentoEntity pag = new PagamentoEntity();
        pag.setValor(new BigDecimal("200.00"));
        pag.setDataVencimento(LocalDate.of(2026, 1, 1));

        assertThat(ContratoHonorariosRecebiveisConciliacaoService.scorePagamentoParcela(contrato, parcela, pag))
                .isZero();
    }

    @Test
    void encontrarLancamentoParaPagamento_creditoCompativel_encontra() {
        PagamentoEntity pag = new PagamentoEntity();
        pag.setValor(new BigDecimal("800.00"));
        pag.setDataVencimento(LocalDate.of(2026, 2, 5));
        pag.setStatus(PagamentoDominio.ST_EMITIDO);

        LancamentoFinanceiroEntity lanc = new LancamentoFinanceiroEntity();
        lanc.setId(55L);
        lanc.setNatureza(NaturezaLancamento.CREDITO);
        lanc.setValor(new BigDecimal("800.00"));
        lanc.setDataLancamento(LocalDate.of(2026, 2, 6));

        Optional<LancamentoFinanceiroEntity> hit = ContratoHonorariosRecebiveisConciliacaoService.encontrarLancamentoParaPagamento(
                pag, List.of(lanc), Set.of());

        assertThat(hit).isPresent();
        assertThat(hit.get().getId()).isEqualTo(55L);
    }

    @Test
    void materializarParcelasDeFinanceiro_criaParcelasDosCreditos() {
        ContratoHonorariosEntity contrato = new ContratoHonorariosEntity();
        contrato.setId(3L);
        contrato.setQuantidadeParcelas(4);
        contrato.setValorTotalParcelas(new BigDecimal("5864.70"));
        contrato.setParcelas(new ArrayList<>());

        List<LancamentoFinanceiroEntity> creditos = List.of(
                lanc(179540L, LocalDate.of(2025, 10, 20), "1466.19"),
                lanc(179618L, LocalDate.of(2025, 11, 20), "1466.17"),
                lanc(179700L, LocalDate.of(2025, 12, 10), "1466.17"),
                lanc(179799L, LocalDate.of(2026, 1, 12), "1466.17"));

        assertThat(ContratoHonorariosRecebiveisConciliacaoService.materializarParcelasDeFinanceiro(contrato, creditos))
                .isTrue();
        assertThat(contrato.getParcelas()).hasSize(4);
        assertThat(contrato.getParcelas().get(0).getValor()).isEqualByComparingTo("1466.19");
        assertThat(contrato.getParcelas().get(0).getDataVencimento()).isEqualTo(LocalDate.of(2025, 10, 20));
    }

    private static LancamentoFinanceiroEntity lanc(Long id, LocalDate data, String valor) {
        LancamentoFinanceiroEntity l = new LancamentoFinanceiroEntity();
        l.setId(id);
        l.setNatureza(NaturezaLancamento.CREDITO);
        l.setDataLancamento(data);
        l.setValor(new BigDecimal(valor));
        return l;
    }
}
