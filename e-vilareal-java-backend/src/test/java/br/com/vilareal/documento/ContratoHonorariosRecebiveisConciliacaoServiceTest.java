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

    @Test
    void resolverParcelasConciliacao_pagamentoUnico_semParcelasDb() {
        ContratoHonorariosEntity contrato = new ContratoHonorariosEntity();
        contrato.setId(2L);
        contrato.setValorFixo(new BigDecimal("1000.00"));
        contrato.setGerarRecebiveis(false);
        contrato.setQuantidadeParcelas(2);
        contrato.setDataContrato(LocalDate.of(2026, 6, 20));
        contrato.setParcelas(new ArrayList<>());

        List<ContratoHonorariosRecebiveisConciliacaoService.ParcelaConciliacao> parcelas =
                ContratoHonorariosRecebiveisConciliacaoService.resolverParcelasConciliacao(contrato);

        assertThat(parcelas).hasSize(1);
        assertThat(parcelas.get(0).valor()).isEqualByComparingTo("1000.00");
        assertThat(parcelas.get(0).numeroParcela()).isEqualTo(1);
    }

    @Test
    void scoreLancamentoSugestao_valorEDataCompativel_pontua() {
        ContratoHonorariosEntity contrato = new ContratoHonorariosEntity();
        contrato.setId(2L);
        contrato.setDataContrato(LocalDate.of(2026, 6, 20));

        ContratoHonorariosRecebiveisConciliacaoService.ParcelaConciliacao parcela =
                new ContratoHonorariosRecebiveisConciliacaoService.ParcelaConciliacao(
                        null, 1, new BigDecimal("1000.00"), LocalDate.of(2026, 6, 20), null, null, null);

        LancamentoFinanceiroEntity lanc = lanc(223807L, LocalDate.of(2026, 6, 22), "1000.00");
        lanc.setDescricao("PIX RECEB.OUTRA IF");

        int score = ContratoHonorariosRecebiveisConciliacaoService.scoreLancamentoSugestao(
                contrato, parcela, lanc, List.of());
        assertThat(score).isGreaterThanOrEqualTo(ContratoHonorariosRecebiveisConciliacaoService.MIN_SCORE_SUGESTAO);
    }

    @Test
    void inequivocoPosImport_rejeitaQuandoGapInsuficiente() {
        assertThat(ContratoHonorariosRecebiveisConciliacaoService.inequivocoParaAutoPosImport(5, 4, 2))
                .isFalse();
    }

    @Test
    void inequivocoPosImport_aceitaUnicoCandidato() {
        assertThat(ContratoHonorariosRecebiveisConciliacaoService.inequivocoParaAutoPosImport(5, 0, 1))
                .isTrue();
    }

    @Test
    void inequivocoPosImport_aceitaComGapMinimo() {
        assertThat(ContratoHonorariosRecebiveisConciliacaoService.inequivocoParaAutoPosImport(6, 3, 2))
                .isTrue();
    }

    @Test
    void rankearPosImport_doisCreditosCompativeis_retornaDois() {
        ContratoHonorariosEntity contrato = new ContratoHonorariosEntity();
        contrato.setValorFixo(new BigDecimal("1000.00"));
        var parcela = new ContratoHonorariosRecebiveisConciliacaoService.ParcelaConciliacao(
                null, 1, new BigDecimal("1000.00"), LocalDate.of(2026, 6, 10), null, null, null);

        LancamentoFinanceiroEntity l1 = lanc(1L, LocalDate.of(2026, 6, 10), "1000.00");
        LancamentoFinanceiroEntity l2 = lanc(2L, LocalDate.of(2026, 6, 11), "1000.00");

        var rankeados = ContratoHonorariosRecebiveisConciliacaoService.rankearCandidatosHonorariosPosImport(
                contrato, parcela, List.of(), List.of(l1, l2), Set.of());

        assertThat(rankeados).hasSize(2);
    }

    @Test
    void rankearPosImport_umCreditoCompativel_retornaUm() {
        ContratoHonorariosEntity contrato = new ContratoHonorariosEntity();
        contrato.setValorFixo(new BigDecimal("500.00"));
        var parcela = new ContratoHonorariosRecebiveisConciliacaoService.ParcelaConciliacao(
                null, 1, new BigDecimal("500.00"), LocalDate.of(2026, 6, 5), null, null, null);
        LancamentoFinanceiroEntity l1 = lanc(9L, LocalDate.of(2026, 6, 5), "500.00");

        var rankeados = ContratoHonorariosRecebiveisConciliacaoService.rankearCandidatosHonorariosPosImport(
                contrato, parcela, List.of(), List.of(l1), Set.of());

        assertThat(rankeados).hasSize(1);
    }

    private static LancamentoFinanceiroEntity lanc(Long id, LocalDate data, String valor) {
        LancamentoFinanceiroEntity l = new LancamentoFinanceiroEntity();
        l.setId(id);
        l.setNatureza(NaturezaLancamento.CREDITO);
        l.setDataLancamento(data);
        l.setValor(new BigDecimal(valor));
        l.setStatus("ATIVO");
        return l;
    }
}
