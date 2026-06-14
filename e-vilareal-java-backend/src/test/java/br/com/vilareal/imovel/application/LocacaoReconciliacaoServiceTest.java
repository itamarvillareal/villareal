package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.imovel.api.dto.ReconciliacaoResultadoResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoSugestaoItemResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoVincularRequest;
import br.com.vilareal.imovel.api.dto.ReconciliacaoVinculoResponse;
import br.com.vilareal.imovel.domain.PapelReconciliacao;
import br.com.vilareal.imovel.domain.StatusRepasse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.LocacaoRepasseLancamentoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.LocacaoRepasseLancamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LocacaoReconciliacaoServiceTest {

    private static final Long CONTRATO_ID = 1L;
    private static final Long PROCESSO_ID = 500L;

    @Mock
    private ContratoLocacaoRepository contratoLocacaoRepository;
    @Mock
    private LocacaoRepasseLancamentoRepository vinculoRepository;
    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private ContaContabilRepository contaContabilRepository;

    @InjectMocks
    private LocacaoReconciliacaoService service;

    // ------------------------------------------------------------------ (C) vínculo grava / desfaz

    @Test
    void vincularGravaNovoVinculoComValorDoLancamento() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contratoTerceiro()));
        LancamentoFinanceiroEntity lanc = lancamento(10L, NaturezaLancamento.CREDITO, "1000.00", LocalDate.of(2026, 3, 10), "ALUGUEL");
        lanc.setProcesso(processoComId(PROCESSO_ID)); // já é do imóvel: não adota, só vincula
        when(lancamentoRepository.findById(10L)).thenReturn(Optional.of(lanc));
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, 10L, PapelReconciliacao.ALUGUEL))
                .thenReturn(Optional.empty());
        when(vinculoRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 77L));

        ReconciliacaoVincularRequest req = new ReconciliacaoVincularRequest(
                List.of(new ReconciliacaoVincularRequest.Item(10L, PapelReconciliacao.ALUGUEL, "2026-03")));

        List<ReconciliacaoVinculoResponse> out = service.vincular(CONTRATO_ID, req);

        assertThat(out).hasSize(1);
        ReconciliacaoVinculoResponse r = out.get(0);
        assertThat(r.id()).isEqualTo(77L);
        assertThat(r.papel()).isEqualTo(PapelReconciliacao.ALUGUEL);
        assertThat(r.competenciaMes()).isEqualTo("2026-03");
        assertThat(r.valor()).isEqualByComparingTo("1000.00");
    }

    @Test
    void vincularEhIdempotenteNaoDuplicaReusaExistente() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contratoTerceiro()));
        LancamentoFinanceiroEntity lanc = lancamento(10L, NaturezaLancamento.CREDITO, "1000.00", LocalDate.of(2026, 3, 10), "ALUGUEL");
        lanc.setProcesso(processoComId(PROCESSO_ID)); // já é do imóvel: não adota, só vincula
        when(lancamentoRepository.findById(10L)).thenReturn(Optional.of(lanc));

        LocacaoRepasseLancamentoEntity existente = new LocacaoRepasseLancamentoEntity();
        existente.setId(55L);
        existente.setContratoLocacao(contratoTerceiro());
        existente.setLancamentoFinanceiro(lanc);
        existente.setPapel(PapelReconciliacao.ALUGUEL);
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, 10L, PapelReconciliacao.ALUGUEL))
                .thenReturn(Optional.of(existente));
        when(vinculoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ReconciliacaoVincularRequest req = new ReconciliacaoVincularRequest(
                List.of(new ReconciliacaoVincularRequest.Item(10L, PapelReconciliacao.ALUGUEL, "2026-03")));

        List<ReconciliacaoVinculoResponse> out = service.vincular(CONTRATO_ID, req);

        ArgumentCaptor<LocacaoRepasseLancamentoEntity> captor =
                ArgumentCaptor.forClass(LocacaoRepasseLancamentoEntity.class);
        verify(vinculoRepository).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(55L); // mesma linha, não cria outra
        assertThat(out.get(0).id()).isEqualTo(55L);
    }

    @Test
    void desvincularRemoveQuandoPertenceAoContrato() {
        LocacaoRepasseLancamentoEntity v = new LocacaoRepasseLancamentoEntity();
        v.setId(9L);
        v.setContratoLocacao(contrato());
        when(vinculoRepository.findById(9L)).thenReturn(Optional.of(v));

        service.desvincular(CONTRATO_ID, 9L);

        verify(vinculoRepository).delete(v);
    }

    @Test
    void desvincularRejeitaVinculoDeOutroContrato() {
        ContratoLocacaoEntity outro = contrato();
        outro.setId(999L);
        LocacaoRepasseLancamentoEntity v = new LocacaoRepasseLancamentoEntity();
        v.setId(9L);
        v.setContratoLocacao(outro);
        when(vinculoRepository.findById(9L)).thenReturn(Optional.of(v));

        assertThatThrownBy(() -> service.desvincular(CONTRATO_ID, 9L))
                .isInstanceOf(BusinessRuleException.class);
        verify(vinculoRepository, never()).delete(any());
    }

    // ------------------------------------------------------------------ (D) resultado só do vinculado

    @Test
    void resultadoComputaSomenteDoQueEstaVinculado() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato()));
        when(vinculoRepository.findByContratoLocacao_IdAndCompetenciaMesOrderByIdAsc(CONTRATO_ID, "2026-03"))
                .thenReturn(List.of(
                        vinculo(PapelReconciliacao.ALUGUEL, "1000.00", "2026-03"),
                        vinculo(PapelReconciliacao.REPASSE, "900.00", "2026-03"),
                        vinculo(PapelReconciliacao.DESPESA, "0.00", "2026-03")));

        ReconciliacaoResultadoResponse r = service.resultado(CONTRATO_ID, "2026-03", null, null);

        assertThat(r.aluguelRecebido()).isEqualByComparingTo("1000.00");
        assertThat(r.repassado()).isEqualByComparingTo("900.00");
        assertThat(r.despesas()).isEqualByComparingTo("0.00");
        assertThat(r.resultadoEscritorio()).isEqualByComparingTo("100.00");
        assertThat(r.taxaEfetivaPercent()).isEqualByComparingTo("10.00");
        assertThat(r.taxaEsperadaPercent()).isEqualByComparingTo("10.00");
        assertThat(r.statusRepasse()).isEqualTo(StatusRepasse.FEITO);
        assertThat(r.porCompetencia()).hasSize(1);
    }

    @Test
    void resultadoStatusPendenteQuandoNaoHaRepasse() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato()));
        when(vinculoRepository.findByContratoLocacao_IdAndCompetenciaMesOrderByIdAsc(CONTRATO_ID, "2026-03"))
                .thenReturn(List.of(vinculo(PapelReconciliacao.ALUGUEL, "1000.00", "2026-03")));

        ReconciliacaoResultadoResponse r = service.resultado(CONTRATO_ID, "2026-03", null, null);

        assertThat(r.statusRepasse()).isEqualTo(StatusRepasse.PENDENTE);
        assertThat(r.repassado()).isEqualByComparingTo("0.00");
    }

    @Test
    void resultadoStatusDivergenteQuandoRepasseNaoBate() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato()));
        when(vinculoRepository.findByContratoLocacao_IdAndCompetenciaMesOrderByIdAsc(CONTRATO_ID, "2026-03"))
                .thenReturn(List.of(
                        vinculo(PapelReconciliacao.ALUGUEL, "1000.00", "2026-03"),
                        vinculo(PapelReconciliacao.REPASSE, "950.00", "2026-03")));

        ReconciliacaoResultadoResponse r = service.resultado(CONTRATO_ID, "2026-03", null, null);

        assertThat(r.statusRepasse()).isEqualTo(StatusRepasse.DIVERGENTE);
    }

    @Test
    void resultadoAgrupaCicloCrossMesPelaCompetenciaNaoPelaDataBancaria() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato()));
        // Aluguel recebido em março e repasse pago em abril, ambos com competência 2026-03.
        LocacaoRepasseLancamentoEntity aluguelMar = vinculo(PapelReconciliacao.ALUGUEL, "1000.00", "2026-03");
        aluguelMar.getLancamentoFinanceiro().setDataLancamento(LocalDate.of(2026, 3, 10));
        LocacaoRepasseLancamentoEntity repasseAbr = vinculo(PapelReconciliacao.REPASSE, "900.00", "2026-03");
        repasseAbr.getLancamentoFinanceiro().setDataLancamento(LocalDate.of(2026, 4, 5));
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of(aluguelMar, repasseAbr));

        ReconciliacaoResultadoResponse r = service.resultado(CONTRATO_ID, null, null, null);

        assertThat(r.porCompetencia()).hasSize(1);
        assertThat(r.porCompetencia().get(0).competencia()).isEqualTo("2026-03");
        assertThat(r.porCompetencia().get(0).statusRepasse()).isEqualTo(StatusRepasse.FEITO);
        assertThat(r.aluguelRecebido()).isEqualByComparingTo("1000.00");
        assertThat(r.repassado()).isEqualByComparingTo("900.00");
    }

    // ------------------------------------------------------------------ (B) motor de sugestão

    @Test
    void sugereAluguelRepasseEDespesaPorSinalValorEDia() {
        // Imóvel de TERCEIRO: o repasse bancário existe (próprio não sugere repasse).
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contratoTerceiro()));
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of());
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(eq(CONTRATO_ID), anyList()))
                .thenReturn(List.of());

        LancamentoFinanceiroEntity aluguel = lancamento(1L, NaturezaLancamento.CREDITO, "1000.00", LocalDate.of(2026, 3, 10), "ALUGUEL FULANO");
        LancamentoFinanceiroEntity repasse = lancamento(2L, NaturezaLancamento.DEBITO, "900.00", LocalDate.of(2026, 3, 15), "REPASSE LOCADOR");
        LancamentoFinanceiroEntity despesa = lancamento(3L, NaturezaLancamento.DEBITO, "50.00", LocalDate.of(2026, 3, 22), "TAXA CONDOMINIO");
        when(lancamentoRepository.findAtivosByProcessoId(PROCESSO_ID))
                .thenReturn(List.of(aluguel, repasse, despesa));

        List<ReconciliacaoSugestaoItemResponse> sug = service.sugerir(CONTRATO_ID, "2026-03");

        assertThat(sug).hasSize(3);
        assertThat(porId(sug, 1L).papelSugerido()).isEqualTo(PapelReconciliacao.ALUGUEL);
        assertThat(porId(sug, 1L).confianca()).isEqualTo(ConfiancaSugestao.ALTA);
        assertThat(porId(sug, 2L).papelSugerido()).isEqualTo(PapelReconciliacao.REPASSE);
        assertThat(porId(sug, 2L).confianca()).isEqualTo(ConfiancaSugestao.ALTA);
        assertThat(porId(sug, 3L).papelSugerido()).isEqualTo(PapelReconciliacao.DESPESA);
    }

    @Test
    void sugereRepasseTerceiroDentroDaBanda() {
        // Imóvel 3: locador Aloísio, aluguel 2.100, taxa 10% → repasseEsperado 1.890.
        ContratoLocacaoEntity c = contratoTerceiro();
        c.setValorAluguel(new BigDecimal("2100.00"));
        c.setDiaRepasse(15);
        c.setLocadorPessoa(pessoa("ALOISIO PEREIRA DOS SANTOS"));
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(c));
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of());
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(eq(CONTRATO_ID), anyList()))
                .thenReturn(List.of());
        LancamentoFinanceiroEntity repasse = lancamento(
                10L, NaturezaLancamento.DEBITO, "1800.00", LocalDate.of(2026, 5, 15), "REPASSE ALOISIO PEREIRA");
        when(lancamentoRepository.findAtivosByProcessoId(PROCESSO_ID)).thenReturn(List.of(repasse));

        List<ReconciliacaoSugestaoItemResponse> sug = service.sugerir(CONTRATO_ID, "2026-05");

        assertThat(porId(sug, 10L).papelSugerido()).isEqualTo(PapelReconciliacao.REPASSE);
        assertThat(porId(sug, 10L).confianca()).isEqualTo(ConfiancaSugestao.ALTA);
    }

    @Test
    void naoSugereRepasseTerceiroForaDaBanda() {
        ContratoLocacaoEntity c = contratoTerceiro();
        c.setValorAluguel(new BigDecimal("2100.00"));
        c.setLocadorPessoa(pessoa("ALOISIO PEREIRA DOS SANTOS"));
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(c));
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of());
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(eq(CONTRATO_ID), anyList()))
                .thenReturn(List.of());
        // Débitos muito acima da banda [1606,50 ; 1984,50] — não viram REPASSE nem em MÉDIA/BAIXA.
        LancamentoFinanceiroEntity gordo1 = lancamento(
                11L, NaturezaLancamento.DEBITO, "12000.00", LocalDate.of(2026, 5, 3), "PAGTO DIVERSOS");
        LancamentoFinanceiroEntity gordo2 = lancamento(
                12L, NaturezaLancamento.DEBITO, "69000.00", LocalDate.of(2026, 5, 20), "TRANSFERENCIA ALOISIO");
        when(lancamentoRepository.findAtivosByProcessoId(PROCESSO_ID)).thenReturn(List.of(gordo1, gordo2));

        List<ReconciliacaoSugestaoItemResponse> sug = service.sugerir(CONTRATO_ID, "2026-05");

        assertThat(sug).noneMatch(s -> s.papelSugerido() == PapelReconciliacao.REPASSE);
        assertThat(porId(sug, 11L).papelSugerido()).isEqualTo(PapelReconciliacao.DESPESA);
        assertThat(porId(sug, 12L).papelSugerido()).isEqualTo(PapelReconciliacao.DESPESA);
    }

    @Test
    void naoSugereRepasseEmImovelProprio() {
        ContratoLocacaoEntity c = contrato(); // cliente 00000938 = próprio
        c.setLocadorPessoa(pessoa("VRV EMPREENDIMENTOS"));
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(c));
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of());
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(eq(CONTRATO_ID), anyList()))
                .thenReturn(List.of());
        // Débito EXATAMENTE no repasse esperado (900) — ainda assim não vira REPASSE no próprio.
        LancamentoFinanceiroEntity debito = lancamento(
                10L, NaturezaLancamento.DEBITO, "900.00", LocalDate.of(2026, 5, 15), "SAIDA");
        when(lancamentoRepository.findAtivosByProcessoId(PROCESSO_ID)).thenReturn(List.of(debito));

        List<ReconciliacaoSugestaoItemResponse> sug = service.sugerir(CONTRATO_ID, "2026-05");

        assertThat(sug).noneMatch(s -> s.papelSugerido() == PapelReconciliacao.REPASSE);
        assertThat(porId(sug, 10L).papelSugerido()).isEqualTo(PapelReconciliacao.DESPESA);
    }

    @Test
    void sugestaoAprendeComHistoricoDePapeisConfirmados() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato()));
        // Histórico: a descrição "TAXA CONDOMINIO" já foi confirmada como DESPESA antes.
        LancamentoFinanceiroEntity historicoLanc = lancamento(99L, NaturezaLancamento.DEBITO, "50.00", LocalDate.of(2026, 1, 22), "TAXA CONDOMINIO");
        LocacaoRepasseLancamentoEntity hist = new LocacaoRepasseLancamentoEntity();
        hist.setLancamentoFinanceiro(historicoLanc);
        hist.setPapel(PapelReconciliacao.DESPESA);
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of(hist));
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(eq(CONTRATO_ID), anyList()))
                .thenReturn(List.of());

        // Candidato com a MESMA descrição normalizada, mas valor que sozinho não indicaria despesa.
        LancamentoFinanceiroEntity candidato = lancamento(7L, NaturezaLancamento.DEBITO, "900.00", LocalDate.of(2026, 3, 15), "TAXA CONDOMINIO");
        when(lancamentoRepository.findAtivosByProcessoId(PROCESSO_ID)).thenReturn(List.of(candidato));

        List<ReconciliacaoSugestaoItemResponse> sug = service.sugerir(CONTRATO_ID, "2026-03");

        assertThat(sug).hasSize(1);
        assertThat(sug.get(0).papelSugerido()).isEqualTo(PapelReconciliacao.DESPESA);
        assertThat(sug.get(0).confianca()).isEqualTo(ConfiancaSugestao.ALTA);
    }

    @Test
    void sugestaoMarcaJaVinculado() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato()));
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of());
        LancamentoFinanceiroEntity aluguel = lancamento(1L, NaturezaLancamento.CREDITO, "1000.00", LocalDate.of(2026, 3, 10), "ALUGUEL");
        when(lancamentoRepository.findAtivosByProcessoId(PROCESSO_ID)).thenReturn(List.of(aluguel));
        LocacaoRepasseLancamentoEntity vinc = new LocacaoRepasseLancamentoEntity();
        vinc.setId(321L);
        vinc.setLancamentoFinanceiro(aluguel);
        vinc.setPapel(PapelReconciliacao.ALUGUEL);
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(eq(CONTRATO_ID), anyList()))
                .thenReturn(List.of(vinc));

        List<ReconciliacaoSugestaoItemResponse> sug = service.sugerir(CONTRATO_ID, "2026-03");

        assertThat(sug.get(0).jaVinculado()).isTrue();
        assertThat(sug.get(0).papelVinculado()).isEqualTo(PapelReconciliacao.ALUGUEL);
        assertThat(sug.get(0).vinculoId()).isEqualTo(321L);
    }

    @Test
    void sugestaoVaziaQuandoImovelSemProcesso() {
        ContratoLocacaoEntity contratoSemProcesso = contrato();
        contratoSemProcesso.getImovel().setProcesso(null);
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contratoSemProcesso));

        assertThat(service.sugerir(CONTRATO_ID, "2026-03")).isEmpty();
        verify(lancamentoRepository, never()).findAtivosByProcessoId(any());
    }

    // ------------------------------------------------------------------ (B.1) órfãos: sugestão + adoção

    @Test
    void sugereOrfaoComoAluguelAdotavelQuandoCasaNomeEValor() {
        ContratoLocacaoEntity c = contrato();
        c.setValorAluguel(new BigDecimal("1700.00"));
        c.setDiaVencimentoAluguel(5);
        c.setInquilinoPessoa(pessoa("ADELAIDE MARIA JERONIMO PEREIRA LOPES"));
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(c));
        when(lancamentoRepository.findAtivosByProcessoId(PROCESSO_ID)).thenReturn(List.of());

        LancamentoFinanceiroEntity orfao = lancamento(
                50L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7),
                "PIX RECEBIDO ADELAIDE MARIA JERONIMO");
        when(lancamentoRepository.findOrfaosAtivosNoIntervalo(any(), any())).thenReturn(List.of(orfao));

        List<ReconciliacaoSugestaoItemResponse> sug = service.sugerir(CONTRATO_ID, "2026-05");

        assertThat(sug).hasSize(1);
        ReconciliacaoSugestaoItemResponse item = sug.get(0);
        assertThat(item.lancamentoFinanceiroId()).isEqualTo(50L);
        assertThat(item.papelSugerido()).isEqualTo(PapelReconciliacao.ALUGUEL);
        assertThat(item.origem()).isEqualTo("ORFAO");
        assertThat(item.classificaAoConfirmar()).isTrue();
        assertThat(item.confianca()).isEqualTo(ConfiancaSugestao.ALTA);
        assertThat(item.codigoClienteAlvo()).isEqualTo("00000938");
        assertThat(item.processoIdAlvo()).isEqualTo(PROCESSO_ID);
    }

    @Test
    void naoSugereOrfaoQuandoNaoCasaNomeNemValor() {
        ContratoLocacaoEntity c = contrato();
        c.setInquilinoPessoa(pessoa("ADELAIDE MARIA JERONIMO"));
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(c));
        when(lancamentoRepository.findAtivosByProcessoId(PROCESSO_ID)).thenReturn(List.of());
        LancamentoFinanceiroEntity outroQualquer = lancamento(
                51L, NaturezaLancamento.CREDITO, "37.50", LocalDate.of(2026, 5, 19), "TARIFA BANCARIA");
        when(lancamentoRepository.findOrfaosAtivosNoIntervalo(any(), any())).thenReturn(List.of(outroQualquer));

        assertThat(service.sugerir(CONTRATO_ID, "2026-05")).isEmpty();
    }

    @Test
    void vincularAdotaOrfaoClassificandoEmContaAClienteProcesso() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contratoTerceiro()));
        LancamentoFinanceiroEntity orfao = lancamento(
                60L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7), "PIX ADELAIDE");
        ContaContabilEntity contaN = new ContaContabilEntity();
        contaN.setId(9L);
        contaN.setCodigo("N");
        contaN.setNome("Não classificado");
        orfao.setContaContabil(contaN);
        orfao.setProcesso(null);
        when(lancamentoRepository.findById(60L)).thenReturn(Optional.of(orfao));
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("A")).thenReturn(Optional.of(contaA()));
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, 60L, PapelReconciliacao.ALUGUEL))
                .thenReturn(Optional.empty());
        when(vinculoRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 88L));

        ReconciliacaoVincularRequest req = new ReconciliacaoVincularRequest(
                List.of(new ReconciliacaoVincularRequest.Item(60L, PapelReconciliacao.ALUGUEL, "2026-05")));

        List<ReconciliacaoVinculoResponse> out = service.vincular(CONTRATO_ID, req);

        ArgumentCaptor<LancamentoFinanceiroEntity> captor =
                ArgumentCaptor.forClass(LancamentoFinanceiroEntity.class);
        verify(lancamentoRepository).save(captor.capture());
        LancamentoFinanceiroEntity salvo = captor.getValue();
        assertThat(salvo.getContaContabil().getCodigo()).isEqualTo("A");
        assertThat(salvo.getClienteEntidade().getId()).isEqualTo(123L);
        assertThat(salvo.getProcesso().getId()).isEqualTo(PROCESSO_ID);
        assertThat(salvo.getEtapa()).isEqualTo(EtapaLancamento.VINCULADO);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).adotado()).isTrue();
        assertThat(out.get(0).contaCodigoAplicada()).isEqualTo("A");
        assertThat(out.get(0).processoAplicadoId()).isEqualTo(PROCESSO_ID);
    }

    @Test
    void vincularRecusaLancamentoQuePertenceAOutroProcesso() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato()));
        LancamentoFinanceiroEntity outro = lancamento(
                70L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7), "PIX");
        outro.setProcesso(processoComId(99999L));
        when(lancamentoRepository.findById(70L)).thenReturn(Optional.of(outro));

        ReconciliacaoVincularRequest req = new ReconciliacaoVincularRequest(
                List.of(new ReconciliacaoVincularRequest.Item(70L, PapelReconciliacao.ALUGUEL, "2026-05")));

        assertThatThrownBy(() -> service.vincular(CONTRATO_ID, req))
                .isInstanceOf(BusinessRuleException.class);
        verify(lancamentoRepository, never()).save(any());
        verify(vinculoRepository, never()).save(any());
    }

    // ------------------------------------------------------------------ repasse interno (imóvel próprio)

    @Test
    void vincularGeraParDeRepasseInternoEmImovelProprio() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato())); // cliente 00000938 = próprio
        LancamentoFinanceiroEntity lanc = lancamento(10L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7), "ADELAIDE");
        lanc.setProcesso(processoComId(PROCESSO_ID));
        when(lancamentoRepository.findById(10L)).thenReturn(Optional.of(lanc));
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, 10L, PapelReconciliacao.ALUGUEL))
                .thenReturn(Optional.empty());
        when(vinculoRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 77L));
        when(lancamentoRepository.findAllByGrupoCompensacao("AUTO-REP-77")).thenReturn(List.of());
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("A")).thenReturn(Optional.of(contaA()));
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("I")).thenReturn(Optional.of(contaI()));

        ReconciliacaoVincularRequest req = new ReconciliacaoVincularRequest(
                List.of(new ReconciliacaoVincularRequest.Item(10L, PapelReconciliacao.ALUGUEL, "2026-05")));

        service.vincular(CONTRATO_ID, req);

        // Par DÉBITO(A)/CRÉDITO(I) de 1530 (1700 − 10% − 0 despesa), banco virtual, origem AUTO, etapa COMPENSADO.
        ArgumentCaptor<LancamentoFinanceiroEntity> lancCaptor = ArgumentCaptor.forClass(LancamentoFinanceiroEntity.class);
        verify(lancamentoRepository, times(2)).save(lancCaptor.capture());
        List<LancamentoFinanceiroEntity> gerados = lancCaptor.getAllValues();
        LancamentoFinanceiroEntity debito = gerados.stream()
                .filter(l -> l.getNatureza() == NaturezaLancamento.DEBITO).findFirst().orElseThrow();
        LancamentoFinanceiroEntity credito = gerados.stream()
                .filter(l -> l.getNatureza() == NaturezaLancamento.CREDITO).findFirst().orElseThrow();
        assertThat(debito.getContaContabil().getCodigo()).isEqualTo("A");
        assertThat(debito.getValor()).isEqualByComparingTo("1530.00");
        assertThat(credito.getContaContabil().getCodigo()).isEqualTo("I");
        assertThat(credito.getValor()).isEqualByComparingTo("1530.00");
        for (LancamentoFinanceiroEntity g : gerados) {
            assertThat(g.getNumeroBanco()).isEqualTo(900);
            assertThat(g.getBancoNome()).isEqualTo("REPASSE INTERNO");
            assertThat(g.getOrigem()).isEqualTo("AUTO");
            assertThat(g.getStatus()).isEqualTo("ATIVO");
            assertThat(g.getEtapa()).isEqualTo(EtapaLancamento.COMPENSADO);
            assertThat(g.getGrupoCompensacao()).isEqualTo("AUTO-REP-77");
        }

        // Vínculos salvos: o ALUGUEL (item) + o REPASSE (gerado, fechando o ciclo).
        ArgumentCaptor<LocacaoRepasseLancamentoEntity> vinCaptor =
                ArgumentCaptor.forClass(LocacaoRepasseLancamentoEntity.class);
        verify(vinculoRepository, times(2)).save(vinCaptor.capture());
        LocacaoRepasseLancamentoEntity repasseVinc = vinCaptor.getAllValues().stream()
                .filter(v -> v.getPapel() == PapelReconciliacao.REPASSE).findFirst().orElseThrow();
        assertThat(repasseVinc.getValor()).isEqualByComparingTo("1530.00");
        assertThat(repasseVinc.getCompetenciaMes()).isEqualTo("2026-05");
        assertThat(repasseVinc.getLancamentoFinanceiro()).isSameAs(debito);
    }

    @Test
    void vincularNaoGeraRepasseInternoEmImovelDeTerceiro() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contratoTerceiro()));
        LancamentoFinanceiroEntity lanc = lancamento(10L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7), "X");
        lanc.setProcesso(processoComId(PROCESSO_ID));
        when(lancamentoRepository.findById(10L)).thenReturn(Optional.of(lanc));
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, 10L, PapelReconciliacao.ALUGUEL))
                .thenReturn(Optional.empty());
        when(vinculoRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 77L));

        service.vincular(CONTRATO_ID, new ReconciliacaoVincularRequest(
                List.of(new ReconciliacaoVincularRequest.Item(10L, PapelReconciliacao.ALUGUEL, "2026-05"))));

        verify(lancamentoRepository, never()).save(any()); // nenhum lançamento gerado
        verify(vinculoRepository, times(1)).save(any());    // só o vínculo de ALUGUEL
    }

    @Test
    void vincularNaoDuplicaRepasseInternoQuandoParJaExiste() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato()));
        LancamentoFinanceiroEntity lanc = lancamento(10L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7), "ADELAIDE");
        lanc.setProcesso(processoComId(PROCESSO_ID));
        when(lancamentoRepository.findById(10L)).thenReturn(Optional.of(lanc));
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, 10L, PapelReconciliacao.ALUGUEL))
                .thenReturn(Optional.empty());
        when(vinculoRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 77L));
        // par já existe e já está na mesma competência (2026-05) — nada a gerar nem sincronizar
        LancamentoFinanceiroEntity parExistente = new LancamentoFinanceiroEntity();
        parExistente.setDataCompetencia(LocalDate.of(2026, 5, 1));
        when(lancamentoRepository.findAllByGrupoCompensacao("AUTO-REP-77"))
                .thenReturn(List.of(parExistente));

        service.vincular(CONTRATO_ID, new ReconciliacaoVincularRequest(
                List.of(new ReconciliacaoVincularRequest.Item(10L, PapelReconciliacao.ALUGUEL, "2026-05"))));

        verify(lancamentoRepository, never()).save(any()); // idempotente: não gera de novo
        verify(vinculoRepository, times(1)).save(any());    // só o vínculo de ALUGUEL
    }

    @Test
    void desvincularRemoveParDeRepasseInternoDoAluguel() {
        LocacaoRepasseLancamentoEntity aluguel = new LocacaoRepasseLancamentoEntity();
        aluguel.setId(77L);
        aluguel.setPapel(PapelReconciliacao.ALUGUEL);
        aluguel.setContratoLocacao(contrato());
        when(vinculoRepository.findById(77L)).thenReturn(Optional.of(aluguel));

        LancamentoFinanceiroEntity debito = lancamento(201L, NaturezaLancamento.DEBITO, "1530.00", LocalDate.of(2026, 5, 1), "Repasse interno");
        LancamentoFinanceiroEntity credito = lancamento(202L, NaturezaLancamento.CREDITO, "1530.00", LocalDate.of(2026, 5, 1), "Renda");
        when(lancamentoRepository.findAllByGrupoCompensacao("AUTO-REP-77")).thenReturn(List.of(debito, credito));
        LocacaoRepasseLancamentoEntity repasseVinc = new LocacaoRepasseLancamentoEntity();
        repasseVinc.setId(78L);
        repasseVinc.setPapel(PapelReconciliacao.REPASSE);
        repasseVinc.setLancamentoFinanceiro(debito);
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(CONTRATO_ID, List.of(201L, 202L)))
                .thenReturn(List.of(repasseVinc));

        service.desvincular(CONTRATO_ID, 77L);

        verify(vinculoRepository).deleteAll(List.of(repasseVinc));
        verify(lancamentoRepository).deleteAll(List.of(debito, credito));
        verify(vinculoRepository).delete(aluguel);
    }

    // ------------------------------------------------------------------ convergência do "Aprovar"

    @Test
    void aprovarCreditoAproxAluguelEmProcessoComContratoCriaVinculoERepasse() {
        LancamentoFinanceiroEntity credito = lancamento(
                180448L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7), "ADELAIDE");
        credito.setProcesso(processoComId(PROCESSO_ID));
        ContratoLocacaoEntity contrato = contrato(); // cliente 00000938 (próprio), VIGENTE
        contrato.setStatus("VIGENTE");
        contrato.setValorAluguel(new BigDecimal("1700.00"));
        when(contratoLocacaoRepository.findByImovelProcessoId(PROCESSO_ID)).thenReturn(List.of(contrato));
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(CONTRATO_ID, List.of(180448L)))
                .thenReturn(List.of()); // (d) sem vínculo
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, 180448L, PapelReconciliacao.ALUGUEL))
                .thenReturn(Optional.empty());
        when(vinculoRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 77L));
        when(lancamentoRepository.findAllByGrupoCompensacao("AUTO-REP-77")).thenReturn(List.of());
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("A")).thenReturn(Optional.of(contaA()));
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("I")).thenReturn(Optional.of(contaI()));

        service.registrarAluguelClassificado(credito);

        verify(lancamentoRepository, times(2)).save(any()); // par DÉBITO(A)/CRÉDITO(I)
        ArgumentCaptor<LocacaoRepasseLancamentoEntity> cap =
                ArgumentCaptor.forClass(LocacaoRepasseLancamentoEntity.class);
        verify(vinculoRepository, times(2)).save(cap.capture()); // vínculo ALUGUEL + REPASSE
        assertThat(cap.getAllValues()).anySatisfy(v -> {
            assertThat(v.getPapel()).isEqualTo(PapelReconciliacao.ALUGUEL);
            assertThat(v.getCompetenciaMes()).isEqualTo("2026-05"); // competência = mês do data_lancamento
        });
        assertThat(cap.getAllValues()).anySatisfy(v -> {
            assertThat(v.getPapel()).isEqualTo(PapelReconciliacao.REPASSE);
            assertThat(v.getValor()).isEqualByComparingTo("1530.00");
        });
    }

    @Test
    void aprovarNaoDuplicaQuandoJaExisteVinculoParaOLancamento() {
        LancamentoFinanceiroEntity credito = lancamento(
                180448L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7), "ADELAIDE");
        credito.setProcesso(processoComId(PROCESSO_ID));
        ContratoLocacaoEntity contrato = contrato();
        contrato.setStatus("VIGENTE");
        contrato.setValorAluguel(new BigDecimal("1700.00"));
        when(contratoLocacaoRepository.findByImovelProcessoId(PROCESSO_ID)).thenReturn(List.of(contrato));
        LocacaoRepasseLancamentoEntity existente = new LocacaoRepasseLancamentoEntity();
        existente.setPapel(PapelReconciliacao.ALUGUEL);
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(CONTRATO_ID, List.of(180448L)))
                .thenReturn(List.of(existente));

        service.registrarAluguelClassificado(credito);

        verify(vinculoRepository, never()).save(any());
        verify(lancamentoRepository, never()).save(any());
    }

    @Test
    void aprovarCreditoForaDaFaixaDoAluguelNaoCriaVinculo() {
        LancamentoFinanceiroEntity credito = lancamento(
                180448L, NaturezaLancamento.CREDITO, "500.00", LocalDate.of(2026, 5, 7), "OUTRO PIX");
        credito.setProcesso(processoComId(PROCESSO_ID));
        ContratoLocacaoEntity contrato = contrato();
        contrato.setStatus("VIGENTE");
        contrato.setValorAluguel(new BigDecimal("1700.00"));
        when(contratoLocacaoRepository.findByImovelProcessoId(PROCESSO_ID)).thenReturn(List.of(contrato));

        service.registrarAluguelClassificado(credito);

        verify(vinculoRepository, never()).save(any());
        verify(lancamentoRepository, never()).save(any());
    }

    @Test
    void aprovarNaoConvergeSemContratoVigenteNoProcesso() {
        LancamentoFinanceiroEntity credito = lancamento(
                180448L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7), "ADELAIDE");
        credito.setProcesso(processoComId(PROCESSO_ID));
        ContratoLocacaoEntity encerrado = contrato();
        encerrado.setStatus("ENCERRADO");
        when(contratoLocacaoRepository.findByImovelProcessoId(PROCESSO_ID)).thenReturn(List.of(encerrado));

        service.registrarAluguelClassificado(credito);

        verify(vinculoRepository, never()).save(any());
        verify(lancamentoRepository, never()).save(any());
    }

    @Test
    void aprovarDebitoNaoConverge() {
        LancamentoFinanceiroEntity debito = lancamento(
                180448L, NaturezaLancamento.DEBITO, "1700.00", LocalDate.of(2026, 5, 7), "SAIDA");
        debito.setProcesso(processoComId(PROCESSO_ID));

        service.registrarAluguelClassificado(debito);

        verify(contratoLocacaoRepository, never()).findByImovelProcessoId(any());
        verify(vinculoRepository, never()).save(any());
    }

    // ------------------------------------------------------------------ helpers

    private static final AtomicLong SEQ = new AtomicLong(1000);

    private static ContratoLocacaoEntity contrato() {
        ProcessoEntity processo = processoComId(PROCESSO_ID);
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(938L);
        cliente.setCodigoCliente("00000938");
        ImovelEntity imovel = new ImovelEntity();
        imovel.setProcesso(processo);
        imovel.setCliente(cliente);
        ContratoLocacaoEntity c = new ContratoLocacaoEntity();
        c.setId(CONTRATO_ID);
        c.setImovel(imovel);
        c.setValorAluguel(new BigDecimal("1000.00"));
        c.setDiaVencimentoAluguel(10);
        c.setDiaRepasse(15);
        c.setTaxaAdministracaoPercent(new BigDecimal("10.00"));
        return c;
    }

    private static ProcessoEntity processoComId(Long id) {
        ProcessoEntity p = new ProcessoEntity();
        p.setId(id);
        p.setNumeroInterno(16042);
        return p;
    }

    private static PessoaEntity pessoa(String nome) {
        PessoaEntity p = new PessoaEntity();
        p.setNome(nome);
        return p;
    }

    private static ContaContabilEntity contaA() {
        ContaContabilEntity c = new ContaContabilEntity();
        c.setId(1L);
        c.setCodigo("A");
        c.setNome("Escritório");
        return c;
    }

    private static ContaContabilEntity contaI() {
        ContaContabilEntity c = new ContaContabilEntity();
        c.setId(11L);
        c.setCodigo("I");
        c.setNome("Imóveis");
        return c;
    }

    /** Contrato de imóvel de TERCEIRO (não-próprio): não dispara o repasse interno. */
    private static ContratoLocacaoEntity contratoTerceiro() {
        ContratoLocacaoEntity c = contrato();
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(123L);
        cliente.setCodigoCliente("00000123");
        c.getImovel().setCliente(cliente);
        return c;
    }

    private static LancamentoFinanceiroEntity lancamento(
            Long id, NaturezaLancamento natureza, String valor, LocalDate data, String descricaoNorm) {
        LancamentoFinanceiroEntity l = new LancamentoFinanceiroEntity();
        l.setId(id);
        l.setNatureza(natureza);
        l.setValor(new BigDecimal(valor));
        l.setDataLancamento(data);
        l.setDescricao(descricaoNorm);
        l.setDescricaoNorm(descricaoNorm);
        return l;
    }

    private static LocacaoRepasseLancamentoEntity vinculo(PapelReconciliacao papel, String valor, String competencia) {
        LocacaoRepasseLancamentoEntity v = new LocacaoRepasseLancamentoEntity();
        v.setId(SEQ.incrementAndGet());
        v.setPapel(papel);
        v.setValor(new BigDecimal(valor));
        v.setCompetenciaMes(competencia);
        LancamentoFinanceiroEntity l = new LancamentoFinanceiroEntity();
        l.setId(SEQ.incrementAndGet());
        l.setNatureza(papel == PapelReconciliacao.ALUGUEL ? NaturezaLancamento.CREDITO : NaturezaLancamento.DEBITO);
        l.setValor(new BigDecimal(valor));
        v.setLancamentoFinanceiro(l);
        return v;
    }

    private static LocacaoRepasseLancamentoEntity withId(LocacaoRepasseLancamentoEntity e, long id) {
        if (e.getId() == null) {
            e.setId(id);
        }
        return e;
    }

    private static ReconciliacaoSugestaoItemResponse porId(List<ReconciliacaoSugestaoItemResponse> lista, Long id) {
        return lista.stream().filter(s -> s.lancamentoFinanceiroId().equals(id)).findFirst().orElseThrow();
    }
}
