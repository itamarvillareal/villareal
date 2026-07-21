package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.financeiro.api.dto.ParearGrupoCompensacaoRequest;
import br.com.vilareal.financeiro.api.dto.ParearGrupoCompensacaoResponse;
import br.com.vilareal.financeiro.application.FinanceiroCompensacaoService;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaBancariaEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaBancariaRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.imovel.api.dto.ConciliarAlugueisAutomaticoResponse;
import br.com.vilareal.imovel.api.dto.MatrizCompetenciasResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoResultadoResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoSugestaoItemResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoVincularRequest;
import br.com.vilareal.imovel.api.dto.ReconciliacaoVinculoResponse;
import br.com.vilareal.imovel.api.dto.RepassePendenteCarteiraResponse;
import br.com.vilareal.imovel.api.dto.RepassePendenteItemResponse;
import br.com.vilareal.imovel.domain.PapelReconciliacao;
import br.com.vilareal.imovel.domain.StatusRepasse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelProcessoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.LocacaoRepasseLancamentoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.LocacaoRepasseLancamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.junit.jupiter.api.BeforeEach;
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
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LocacaoReconciliacaoServiceTest {

    private static final Long CONTRATO_ID = 1L;
    private static final Long PROCESSO_ID = 500L;
    private static final Long IMOVEL_ID = 77L;

    @Mock
    private ContratoLocacaoRepository contratoLocacaoRepository;
    @Mock
    private LocacaoRepasseLancamentoRepository vinculoRepository;
    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private ContaContabilRepository contaContabilRepository;
    @Mock
    private ContaBancariaRepository contaBancariaRepository;
    @Mock
    private ImovelProcessoRepository imovelProcessoRepository;
    @Mock
    private FinanceiroCompensacaoService financeiroCompensacaoService;
    @Mock
    private ImovelVinculoProcessoPrincipalResolver vinculoPrincipalResolver;

    @InjectMocks
    private LocacaoReconciliacaoService service;

    @BeforeEach
    void stubContasRepasseInterno() {
        lenient().when(vinculoPrincipalResolver.resolverProcessoDoContrato(any())).thenAnswer(inv -> {
            ContratoLocacaoEntity c = inv.getArgument(0);
            if (c == null || c.getImovel() == null || c.getImovel().getId() == null) {
                return Optional.empty();
            }
            ProcessoEntity escalar = c.getImovel().getProcesso();
            if (escalar != null && escalar.getId() != null) {
                return Optional.of(escalar);
            }
            return imovelProcessoRepository
                    .findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(c.getImovel().getId())
                    .map(ImovelProcessoEntity::getProcesso)
                    .filter(p -> p.getNumeroInterno() != null);
        });
        lenient().when(contaBancariaRepository.findByNumeroBanco(19)).thenReturn(Optional.of(contaZero()));
        lenient().when(contaBancariaRepository.findByTipo("VIRTUAL")).thenReturn(List.of(contaVirtual()));
        lenient().when(contaContabilRepository.findFirstByCodigoIgnoreCase("A")).thenReturn(Optional.of(contaA()));
        lenient().when(contaContabilRepository.findFirstByCodigoIgnoreCase("I")).thenReturn(Optional.of(contaI()));
        lenient()
                .when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(IMOVEL_ID))
                .thenReturn(Optional.of(imovelProcessoAtivo(processoComId(PROCESSO_ID))));
        lenient().when(lancamentoRepository.save(any())).thenAnswer(inv -> {
            LancamentoFinanceiroEntity l = inv.getArgument(0);
            if (l.getId() == null) {
                l.setId(SEQ.incrementAndGet());
            }
            return l;
        });
        lenient().when(financeiroCompensacaoService.parearGrupo(any())).thenAnswer(inv -> {
            ParearGrupoCompensacaoRequest req = inv.getArgument(0);
            ParearGrupoCompensacaoResponse resp = new ParearGrupoCompensacaoResponse();
            resp.setGrupoCompensacao(req.getGrupoCompensacao());
            resp.setLancamentos(req.getLancamentoIds() != null ? req.getLancamentoIds().size() : 0);
            return resp;
        });
    }

    private static ImovelProcessoEntity imovelProcessoAtivo(ProcessoEntity processo) {
        ImovelProcessoEntity ip = new ImovelProcessoEntity();
        ip.setId(1L);
        ip.setProcesso(processo);
        ip.setAtivo(true);
        return ip;
    }

    private static ContaBancariaEntity contaVirtual() {
        ContaBancariaEntity c = new ContaBancariaEntity();
        c.setId(900L);
        c.setNumeroBanco(900);
        c.setBancoNome("REPASSE INTERNO");
        c.setTipo("VIRTUAL");
        c.setTemExtrato(false);
        c.setAtivo(true);
        return c;
    }

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
                List.of(new ReconciliacaoVincularRequest.Item(10L, PapelReconciliacao.ALUGUEL, "2026-03", null)));

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
        existente.setCompetenciaMes("2026-03");
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, 10L, PapelReconciliacao.ALUGUEL))
                .thenReturn(Optional.of(existente));

        ReconciliacaoVincularRequest req = new ReconciliacaoVincularRequest(
                List.of(new ReconciliacaoVincularRequest.Item(10L, PapelReconciliacao.ALUGUEL, "2026-03", null)));

        List<ReconciliacaoVinculoResponse> out = service.vincular(CONTRATO_ID, req);

        verify(vinculoRepository, never()).save(any());
        assertThat(out.get(0).id()).isEqualTo(55L);
        assertThat(out.get(0).competenciaMes()).isEqualTo("2026-03");
    }

    @Test
    void vincularAtualizaCompetenciaQuandoVinculoJaExiste() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contratoTerceiro()));
        LancamentoFinanceiroEntity lanc = lancamento(10L, NaturezaLancamento.CREDITO, "1000.00", LocalDate.of(2026, 3, 10), "ALUGUEL");
        lanc.setProcesso(processoComId(PROCESSO_ID));
        when(lancamentoRepository.findById(10L)).thenReturn(Optional.of(lanc));

        LocacaoRepasseLancamentoEntity existente = new LocacaoRepasseLancamentoEntity();
        existente.setId(55L);
        existente.setContratoLocacao(contratoTerceiro());
        existente.setLancamentoFinanceiro(lanc);
        existente.setPapel(PapelReconciliacao.ALUGUEL);
        existente.setCompetenciaMes("2026-03");
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, 10L, PapelReconciliacao.ALUGUEL))
                .thenReturn(Optional.of(existente));
        when(vinculoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ReconciliacaoVincularRequest req = new ReconciliacaoVincularRequest(
                List.of(new ReconciliacaoVincularRequest.Item(10L, PapelReconciliacao.ALUGUEL, "2026-04", null)));

        List<ReconciliacaoVinculoResponse> out = service.vincular(CONTRATO_ID, req);

        verify(vinculoRepository).save(existente);
        assertThat(existente.getCompetenciaMes()).isEqualTo("2026-04");
        assertThat(out.get(0).competenciaMes()).isEqualTo("2026-04");
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
    void resultadoRepasseFeitoQuandoTaxaIncideSobreValorContrato() {
        ContratoLocacaoEntity c = contrato();
        c.setValorAluguel(new BigDecimal("1750.00"));
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(c));
        when(vinculoRepository.findByContratoLocacao_IdAndCompetenciaMesOrderByIdAsc(CONTRATO_ID, "2026-06"))
                .thenReturn(List.of(
                        vinculo(PapelReconciliacao.ALUGUEL, "1707.83", "2026-06"),
                        vinculo(PapelReconciliacao.REPASSE, "1532.83", "2026-06")));

        ReconciliacaoResultadoResponse r = service.resultado(CONTRATO_ID, "2026-06", null, null);

        assertThat(r.aluguelRecebido()).isEqualByComparingTo("1707.83");
        assertThat(r.repassado()).isEqualByComparingTo("1532.83");
        assertThat(r.statusRepasse()).isEqualTo(StatusRepasse.FEITO);
    }

    @Test
    void repassesPendentesListaCiclosComAluguelSemRepasse() {
        ContratoLocacaoEntity c = contratoComLocador();
        LocacaoRepasseLancamentoEntity aluguel =
                vinculoComContrato(c, PapelReconciliacao.ALUGUEL, "1000.00", "2026-03");
        when(vinculoRepository.findAllParaCarteiraRepasses()).thenReturn(List.of(aluguel));

        RepassePendenteCarteiraResponse carteira = service.repassesPendentes(null);

        assertThat(carteira.itens()).hasSize(1);
        RepassePendenteItemResponse item = carteira.itens().get(0);
        assertThat(item.contratoId()).isEqualTo(CONTRATO_ID);
        assertThat(item.imovelNumeroPlanilha()).isEqualTo(42);
        assertThat(item.imovelEndereco()).isEqualTo("Rua A, 1");
        assertThat(item.locadorNome()).isEqualTo("Maria Locadora");
        assertThat(item.dadosBancariosRepasse()).contains("341");
        assertThat(item.competencia()).isEqualTo("2026-03");
        assertThat(item.aluguel()).isEqualByComparingTo("1000.00");
        assertThat(item.taxaEsperadaValor()).isEqualByComparingTo("100.00");
        assertThat(item.repassado()).isEqualByComparingTo("0.00");
        assertThat(item.repasseEsperado()).isEqualByComparingTo("900.00");
        assertThat(item.valorEmAberto()).isEqualByComparingTo("900.00");
        assertThat(item.statusRepasse()).isEqualTo(StatusRepasse.PENDENTE);
        assertThat(carteira.totalEmAberto()).isEqualByComparingTo("900.00");
    }

    @Test
    void repassesPendentesIgnoraCicloFeitoERespeitaFiltroAte() {
        ContratoLocacaoEntity c = contratoComLocador();
        LocacaoRepasseLancamentoEntity pendente =
                vinculoComContrato(c, PapelReconciliacao.ALUGUEL, "1000.00", "2026-04");
        pendente.setCompetenciaMes("2026-04");
        LocacaoRepasseLancamentoEntity feitoAluguel =
                vinculoComContrato(c, PapelReconciliacao.ALUGUEL, "1000.00", "2026-03");
        LocacaoRepasseLancamentoEntity feitoRepasse =
                vinculoComContrato(c, PapelReconciliacao.REPASSE, "900.00", "2026-03");
        when(vinculoRepository.findAllParaCarteiraRepasses())
                .thenReturn(List.of(feitoAluguel, feitoRepasse, pendente));

        RepassePendenteCarteiraResponse carteira = service.repassesPendentes("2026-03");

        assertThat(carteira.itens()).isEmpty();
        assertThat(carteira.totalEmAberto()).isEqualByComparingTo("0.00");
    }

    @Test
    void resultadoExpoeLocadorEDadosBancarios() {
        ContratoLocacaoEntity c = contratoComLocador();
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(c));
        when(vinculoRepository.findByContratoLocacao_IdAndCompetenciaMesOrderByIdAsc(CONTRATO_ID, "2026-03"))
                .thenReturn(List.of(vinculoComContrato(c, PapelReconciliacao.ALUGUEL, "1000.00", "2026-03")));

        ReconciliacaoResultadoResponse r = service.resultado(CONTRATO_ID, "2026-03", null, null);

        assertThat(r.locadorNome()).isEqualTo("Maria Locadora");
        assertThat(r.dadosBancariosRepasse()).contains("341");
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
        when(lancamentoRepository.findByProcessoId(PROCESSO_ID))
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
        when(lancamentoRepository.findByProcessoId(PROCESSO_ID)).thenReturn(List.of(repasse));

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
        when(lancamentoRepository.findByProcessoId(PROCESSO_ID)).thenReturn(List.of(gordo1, gordo2));

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
        when(lancamentoRepository.findByProcessoId(PROCESSO_ID)).thenReturn(List.of(debito));

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
        when(lancamentoRepository.findByProcessoId(PROCESSO_ID)).thenReturn(List.of(candidato));

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
        when(lancamentoRepository.findByProcessoId(PROCESSO_ID)).thenReturn(List.of(aluguel));
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
        // Fonte única: sem linha ATIVA em imovel_processo → reconciliação cega (esperado).
        when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(IMOVEL_ID))
                .thenReturn(Optional.empty());
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contratoSemProcesso));

        assertThat(service.sugerir(CONTRATO_ID, "2026-03")).isEmpty();
        verify(lancamentoRepository, never()).findByProcessoId(any());
    }

    @Test
    void resolveProcessoPelaLinhaAtivaDoNaN_mesmoComEscalarNulo() {
        // Item 4 (fonte única): o escalar imovel.processo_id é IGNORADO; vale a linha ATIVA do N:N.
        ContratoLocacaoEntity c = contrato();
        c.getImovel().setProcesso(null); // escalar nulo de propósito: prova que a fonte é o N:N
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(c));
        LancamentoFinanceiroEntity lanc = lancamento(
                10L, NaturezaLancamento.CREDITO, "1000.00", LocalDate.of(2026, 3, 10), "ALUGUEL");
        when(lancamentoRepository.findByProcessoId(PROCESSO_ID)).thenReturn(List.of(lanc));

        List<ReconciliacaoSugestaoItemResponse> sug = service.sugerir(CONTRATO_ID, "2026-03");

        assertThat(sug).hasSize(1);
        // confirma que buscou os lançamentos do processo vindo do N:N ativo (PROCESSO_ID), não do escalar.
        verify(lancamentoRepository).findByProcessoId(PROCESSO_ID);
    }

    // ------------------------------------------------------------------ (B.1) órfãos: sugestão + adoção

    @Test
    void sugereOrfaoComoAluguelAdotavelQuandoCasaNomeEValor() {
        ContratoLocacaoEntity c = contrato();
        c.setValorAluguel(new BigDecimal("1700.00"));
        c.setDiaVencimentoAluguel(5);
        c.setInquilinoPessoa(pessoa("ADELAIDE MARIA JERONIMO PEREIRA LOPES"));
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(c));
        when(lancamentoRepository.findByProcessoId(PROCESSO_ID)).thenReturn(List.of());

        LancamentoFinanceiroEntity orfao = lancamento(
                50L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7),
                "PIX RECEBIDO ADELAIDE MARIA JERONIMO");
        when(lancamentoRepository.findOrfaosNoIntervalo(any(), any())).thenReturn(List.of(orfao));

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
        when(lancamentoRepository.findByProcessoId(PROCESSO_ID)).thenReturn(List.of());
        LancamentoFinanceiroEntity outroQualquer = lancamento(
                51L, NaturezaLancamento.CREDITO, "37.50", LocalDate.of(2026, 5, 19), "TARIFA BANCARIA");
        when(lancamentoRepository.findOrfaosNoIntervalo(any(), any())).thenReturn(List.of(outroQualquer));

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
                List.of(new ReconciliacaoVincularRequest.Item(60L, PapelReconciliacao.ALUGUEL, "2026-05", null)));

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
                List.of(new ReconciliacaoVincularRequest.Item(70L, PapelReconciliacao.ALUGUEL, "2026-05", null)));

        assertThatThrownBy(() -> service.vincular(CONTRATO_ID, req))
                .isInstanceOf(BusinessRuleException.class);
        verify(lancamentoRepository, never()).save(any());
        verify(vinculoRepository, never()).save(any());
    }

    // ------------------------------------------------------------------ repasse interno (imóvel próprio)

    @Test
    void vincularNaoGeraRepasseInternoAutomaticamenteEmImovelProprio() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato()));
        LancamentoFinanceiroEntity lanc = lancamento(10L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7), "ADELAIDE");
        lanc.setProcesso(processoComId(PROCESSO_ID));
        when(lancamentoRepository.findById(10L)).thenReturn(Optional.of(lanc));
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, 10L, PapelReconciliacao.ALUGUEL))
                .thenReturn(Optional.empty());
        when(vinculoRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 77L));

        service.vincular(CONTRATO_ID, new ReconciliacaoVincularRequest(
                List.of(new ReconciliacaoVincularRequest.Item(10L, PapelReconciliacao.ALUGUEL, "2026-05", null))));

        verify(lancamentoRepository, never()).save(any());
        verify(vinculoRepository, times(1)).save(any());
    }

    @Test
    void gerarRepassesInternosGeraParDebitoCreditoNaContaZero() {
        ContratoLocacaoEntity c = contrato();
        c.setValorAluguel(new BigDecimal("1700.00"));
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(c));
        LocacaoRepasseLancamentoEntity aluguel = vinculoAluguel(77L, "1700.00", "2026-05", LocalDate.of(2026, 5, 7));
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of(aluguel));
        when(vinculoRepository.findByContratoLocacao_IdAndCompetenciaMesOrderByIdAsc(CONTRATO_ID, "2026-05"))
                .thenReturn(List.of());
        when(vinculoRepository.findByOrigemAluguelVinculo_IdAndPapel(77L, PapelReconciliacao.REPASSE))
                .thenReturn(Optional.empty());
        when(vinculoRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 88L));

        var resp = service.gerarRepassesInternosContrato(CONTRATO_ID, "2026-05");

        assertThat(resp.repassesGerados()).isEqualTo(1);
        ArgumentCaptor<LancamentoFinanceiroEntity> cap = ArgumentCaptor.forClass(LancamentoFinanceiroEntity.class);
        verify(lancamentoRepository, times(2)).save(cap.capture());
        LancamentoFinanceiroEntity debito = cap.getAllValues().stream()
                .filter(l -> l.getNatureza() == NaturezaLancamento.DEBITO).findFirst().orElseThrow();
        LancamentoFinanceiroEntity credito = cap.getAllValues().stream()
                .filter(l -> l.getNatureza() == NaturezaLancamento.CREDITO).findFirst().orElseThrow();
        assertThat(debito.getValor()).isEqualByComparingTo("1530.00");
        assertThat(credito.getValor()).isEqualByComparingTo("1530.00");
        assertThat(debito.getNumeroLancamento()).isEqualTo("AUTO-REP-77-D");
        assertThat(credito.getNumeroLancamento()).isEqualTo("AUTO-REP-77-C");
        assertThat(debito.getNumeroBanco()).isEqualTo(19);
        assertThat(credito.getNumeroBanco()).isEqualTo(19);
        assertThat(debito.getContaContabil().getCodigo()).isEqualTo("A");
        assertThat(credito.getContaContabil().getCodigo()).isEqualTo("I");
        assertThat(debito.getPessoaRef()).isNotNull();
        assertThat(credito.getPessoaRef()).isEqualTo(debito.getPessoaRef());
        assertThat(debito.getDataLancamento()).isEqualTo(LocalDate.of(2026, 5, 7));
        ArgumentCaptor<ParearGrupoCompensacaoRequest> parearCap =
                ArgumentCaptor.forClass(ParearGrupoCompensacaoRequest.class);
        verify(financeiroCompensacaoService).parearGrupo(parearCap.capture());
        assertThat(parearCap.getValue().getGrupoCompensacao()).isEqualTo("AUTO-REP-77");
        assertThat(parearCap.getValue().getLancamentoIds()).hasSize(2);
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
                List.of(new ReconciliacaoVincularRequest.Item(10L, PapelReconciliacao.ALUGUEL, "2026-05", null))));

        verify(lancamentoRepository, never()).save(any()); // nenhum lançamento gerado
        verify(vinculoRepository, times(1)).save(any());    // só o vínculo de ALUGUEL
    }

    @Test
    void vincularNaoDuplicaRepasseInternoQuandoDebitoJaExiste() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato()));
        LancamentoFinanceiroEntity lanc = lancamento(10L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7), "ADELAIDE");
        lanc.setProcesso(processoComId(PROCESSO_ID));
        when(lancamentoRepository.findById(10L)).thenReturn(Optional.of(lanc));
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, 10L, PapelReconciliacao.ALUGUEL))
                .thenReturn(Optional.empty());
        when(vinculoRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 77L));

        service.vincular(CONTRATO_ID, new ReconciliacaoVincularRequest(
                List.of(new ReconciliacaoVincularRequest.Item(10L, PapelReconciliacao.ALUGUEL, "2026-05", null))));

        verify(lancamentoRepository, never()).save(any());
        verify(vinculoRepository, times(1)).save(any());
    }

    @Test
    void gerarRepassesInternosSincronizaCompetenciaMantendoDataDoAluguel() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato()));
        LocacaoRepasseLancamentoEntity aluguel = vinculoAluguel(77L, "1700.00", "2026-05", LocalDate.of(2026, 6, 5));
        aluguel.setContratoLocacao(contrato());
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of(aluguel));
        LancamentoFinanceiroEntity debitoExistente = debitoRepasseInterno(201L, "1530.00", LocalDate.of(2026, 6, 5), "AUTO-REP-77-D", 77L);
        debitoExistente.setDataCompetencia(LocalDate.of(2026, 6, 1));
        debitoExistente.setDescricao("Repasse interno (imóvel próprio) 2026-06");
        LancamentoFinanceiroEntity creditoExistente = creditoRepasseInterno(202L, "1530.00", LocalDate.of(2026, 6, 5), "AUTO-REP-77-C", 77L);
        creditoExistente.setDataCompetencia(LocalDate.of(2026, 6, 1));
        LocacaoRepasseLancamentoEntity repasseVinc = new LocacaoRepasseLancamentoEntity();
        repasseVinc.setId(78L);
        repasseVinc.setPapel(PapelReconciliacao.REPASSE);
        repasseVinc.setCompetenciaMes("2026-06");
        repasseVinc.setLancamentoFinanceiro(debitoExistente);
        when(vinculoRepository.findByOrigemAluguelVinculo_IdAndPapel(77L, PapelReconciliacao.REPASSE))
                .thenReturn(Optional.of(repasseVinc));
        when(lancamentoRepository.findByNumeroLancamento("AUTO-REP-77-C")).thenReturn(Optional.of(creditoExistente));
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(CONTRATO_ID, List.of(201L)))
                .thenReturn(List.of(repasseVinc));

        service.gerarRepassesInternosContrato(CONTRATO_ID, "2026-05");

        assertThat(debitoExistente.getDataCompetencia()).isEqualTo(LocalDate.of(2026, 5, 1));
        assertThat(debitoExistente.getDataLancamento()).isEqualTo(LocalDate.of(2026, 6, 5));
        assertThat(creditoExistente.getDataCompetencia()).isEqualTo(LocalDate.of(2026, 5, 1));
        assertThat(repasseVinc.getCompetenciaMes()).isEqualTo("2026-05");
        verify(lancamentoRepository).save(debitoExistente);
        verify(lancamentoRepository).save(creditoExistente);
    }

    @Test
    void desvincularRemoveDebitoRepasseInternoDoAluguel() {
        LocacaoRepasseLancamentoEntity aluguel = new LocacaoRepasseLancamentoEntity();
        aluguel.setId(77L);
        aluguel.setPapel(PapelReconciliacao.ALUGUEL);
        aluguel.setContratoLocacao(contrato());
        when(vinculoRepository.findById(77L)).thenReturn(Optional.of(aluguel));

        LancamentoFinanceiroEntity debito = lancamento(201L, NaturezaLancamento.DEBITO, "1530.00", LocalDate.of(2026, 5, 7), "Repasse interno");
        LocacaoRepasseLancamentoEntity repasseVinc = new LocacaoRepasseLancamentoEntity();
        repasseVinc.setId(78L);
        repasseVinc.setPapel(PapelReconciliacao.REPASSE);
        repasseVinc.setLancamentoFinanceiro(debito);
        // reversão acha o REPASSE pela FK real (V115), não pela string
        when(vinculoRepository.findByOrigemAluguelVinculo_IdAndPapel(77L, PapelReconciliacao.REPASSE))
                .thenReturn(Optional.of(repasseVinc));
        LancamentoFinanceiroEntity credito = creditoRepasseInterno(202L, "1530.00", LocalDate.of(2026, 5, 7), "AUTO-REP-77-C", 77L);
        when(lancamentoRepository.findByNumeroLancamento("AUTO-REP-77-C")).thenReturn(Optional.of(credito));

        service.desvincular(CONTRATO_ID, 77L);

        verify(vinculoRepository).delete(repasseVinc);
        verify(lancamentoRepository).delete(debito);
        verify(lancamentoRepository).delete(credito);
        verify(vinculoRepository).delete(aluguel);
    }

    @Test
    void corrigirNaoMexeQuandoDebitoJaEstaCorreto() {
        ContratoLocacaoEntity c = contrato();
        c.setValorAluguel(new BigDecimal("1700.00"));
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(c)); // próprio
        LocacaoRepasseLancamentoEntity aluguel = vinculoAluguel(5L, "1700.00", "2026-05", LocalDate.of(2026, 5, 7));
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of(aluguel));
        when(vinculoRepository.findByContratoLocacao_IdAndCompetenciaMesOrderByIdAsc(CONTRATO_ID, "2026-05"))
                .thenReturn(List.of()); // sem despesas

        // débito já correto: conta A, DEBITO, data = data do aluguel (07/05), sem grupo, VINCULADO, valor 1530
        LancamentoFinanceiroEntity debito = debitoRepasseInterno(201L, "1530.00", LocalDate.of(2026, 5, 7), "AUTO-REP-5-D", 5L);
        LancamentoFinanceiroEntity credito = creditoRepasseInterno(202L, "1530.00", LocalDate.of(2026, 5, 7), "AUTO-REP-5-C", 5L);
        when(lancamentoRepository.findByProcessoId(PROCESSO_ID)).thenReturn(List.of(debito, credito));
        when(lancamentoRepository.findByNumeroLancamento("AUTO-REP-5-C")).thenReturn(Optional.of(credito));
        // FK real (V115): o REPASSE do ALUGUEL 5 já existe e aponta para o débito correto.
        LocacaoRepasseLancamentoEntity repasseVinc = new LocacaoRepasseLancamentoEntity();
        repasseVinc.setPapel(PapelReconciliacao.REPASSE);
        repasseVinc.setLancamentoFinanceiro(debito);
        when(vinculoRepository.findByOrigemAluguelVinculo_IdAndPapel(5L, PapelReconciliacao.REPASSE))
                .thenReturn(Optional.of(repasseVinc));

        int corrigidos = service.corrigirRepasseInternoContrato(CONTRATO_ID);

        assertThat(corrigidos).isZero(); // NO-OP: nada a corrigir
        verify(lancamentoRepository, never()).delete(any(LancamentoFinanceiroEntity.class));
        verify(lancamentoRepository, never()).deleteAll(anyList());
        verify(lancamentoRepository, never()).save(any());
        verify(vinculoRepository, never()).delete(any(LocacaoRepasseLancamentoEntity.class));
        verify(vinculoRepository, never()).deleteAll(anyList());
        verify(vinculoRepository, never()).save(any());
    }

    @Test
    void corrigirRegeneraSomenteODebitoErrado() {
        ContratoLocacaoEntity c = contrato();
        c.setValorAluguel(new BigDecimal("1700.00"));
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(c));
        LocacaoRepasseLancamentoEntity aluguel = vinculoAluguel(5L, "1700.00", "2026-05", LocalDate.of(2026, 5, 7));
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of(aluguel));
        when(vinculoRepository.findByContratoLocacao_IdAndCompetenciaMesOrderByIdAsc(CONTRATO_ID, "2026-05"))
                .thenReturn(List.of());

        // débito ERRADO: datado em 01/MM (antes do recebimento) — deve ser removido e regenerado.
        LancamentoFinanceiroEntity errado = debitoRepasseInterno(201L, "1530.00", LocalDate.of(2026, 5, 1), "AUTO-REP-5-D", 5L);
        when(lancamentoRepository.findByProcessoId(PROCESSO_ID)).thenReturn(List.of(errado));
        when(lancamentoRepository.findByNumeroLancamento("AUTO-REP-5-C")).thenReturn(Optional.empty());
        LocacaoRepasseLancamentoEntity repasseErrado = new LocacaoRepasseLancamentoEntity();
        repasseErrado.setId(78L);
        repasseErrado.setPapel(PapelReconciliacao.REPASSE);
        repasseErrado.setLancamentoFinanceiro(errado);
        // FK real (V115): o REPASSE existe e está errado; ao removê-lo, a FK deixa de existir e gera-se o novo.
        AtomicReference<Optional<LocacaoRepasseLancamentoEntity>> repassePorFk =
                new AtomicReference<>(Optional.of(repasseErrado));
        when(vinculoRepository.findByOrigemAluguelVinculo_IdAndPapel(5L, PapelReconciliacao.REPASSE))
                .thenAnswer(inv -> repassePorFk.get());
        doAnswer(inv -> { repassePorFk.set(Optional.empty()); return null; })
                .when(vinculoRepository).delete(repasseErrado);
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("A")).thenReturn(Optional.of(contaA()));

        int corrigidos = service.corrigirRepasseInternoContrato(CONTRATO_ID);

        assertThat(corrigidos).isEqualTo(1);
        verify(financeiroCompensacaoService).desparear("AUTO-REP-5");
        verify(vinculoRepository).delete(repasseErrado);
        ArgumentCaptor<LancamentoFinanceiroEntity> cap = ArgumentCaptor.forClass(LancamentoFinanceiroEntity.class);
        verify(lancamentoRepository, times(2)).save(cap.capture());
        assertThat(cap.getAllValues()).anySatisfy(l -> {
            assertThat(l.getNatureza()).isEqualTo(NaturezaLancamento.DEBITO);
            assertThat(l.getDataLancamento()).isEqualTo(LocalDate.of(2026, 5, 7));
            assertThat(l.getValor()).isEqualByComparingTo("1530.00");
            assertThat(l.getNumeroLancamento()).isEqualTo("AUTO-REP-5-D");
        });
        assertThat(cap.getAllValues()).anySatisfy(l -> {
            assertThat(l.getNatureza()).isEqualTo(NaturezaLancamento.CREDITO);
            assertThat(l.getNumeroLancamento()).isEqualTo("AUTO-REP-5-C");
        });
    }

    // ------------------------------------------------------------------ convergência do "Aprovar"

    @Test
    void aprovarCreditoAproxAluguelEmProcessoComContratoCriaVinculoAluguel() {
        LancamentoFinanceiroEntity credito = lancamento(
                180448L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7), "ADELAIDE");
        credito.setProcesso(processoComId(PROCESSO_ID));
        ContratoLocacaoEntity contrato = contrato();
        contrato.setStatus("VIGENTE");
        contrato.setValorAluguel(new BigDecimal("1700.00"));
        when(contratoLocacaoRepository.findByImovelProcessoId(PROCESSO_ID)).thenReturn(List.of(contrato));
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(CONTRATO_ID, List.of(180448L)))
                .thenReturn(List.of());
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, 180448L, PapelReconciliacao.ALUGUEL))
                .thenReturn(Optional.empty());
        when(vinculoRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 77L));

        service.registrarAluguelClassificado(credito);

        verify(lancamentoRepository, never()).save(any());
        ArgumentCaptor<LocacaoRepasseLancamentoEntity> cap =
                ArgumentCaptor.forClass(LocacaoRepasseLancamentoEntity.class);
        verify(vinculoRepository, times(1)).save(cap.capture());
        assertThat(cap.getValue().getPapel()).isEqualTo(PapelReconciliacao.ALUGUEL);
        assertThat(cap.getValue().getCompetenciaMes()).isEqualTo("2026-05");
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

    // ------------------------------------------------------------------ B2: conta VIRTUAL (não 900 hardcoded)

    @Test
    void repasseInternoUsaContaZeroNumeroBanco19() {
        ContaBancariaEntity cz = contaZero();
        cz.setBancoNome("CONTA ZERO (TESTE)");
        when(contaBancariaRepository.findByNumeroBanco(19)).thenReturn(Optional.of(cz));
        ContratoLocacaoEntity c = contrato();
        c.setValorAluguel(new BigDecimal("1700.00"));
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(c));
        LocacaoRepasseLancamentoEntity aluguel = vinculoAluguel(77L, "1700.00", "2026-05", LocalDate.of(2026, 5, 7));
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of(aluguel));
        when(vinculoRepository.findByOrigemAluguelVinculo_IdAndPapel(77L, PapelReconciliacao.REPASSE))
                .thenReturn(Optional.empty());
        when(vinculoRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 88L));

        service.gerarRepassesInternosContrato(CONTRATO_ID, "2026-05");

        ArgumentCaptor<LancamentoFinanceiroEntity> cap = ArgumentCaptor.forClass(LancamentoFinanceiroEntity.class);
        verify(lancamentoRepository, times(2)).save(cap.capture());
        LancamentoFinanceiroEntity debito = cap.getAllValues().stream()
                .filter(l -> l.getNatureza() == NaturezaLancamento.DEBITO).findFirst().orElseThrow();
        assertThat(debito.getNumeroBanco()).isEqualTo(19);
        assertThat(debito.getBancoNome()).isEqualTo("CONTA ZERO (TESTE)");
        assertThat(debito.getContaBancaria()).isSameAs(cz);
        assertThat(debito.getValor()).isEqualByComparingTo("1530.00");
    }

    @Test
    void repasseInternoSemContaZeroFalhaClaro() {
        when(contaBancariaRepository.findByNumeroBanco(19)).thenReturn(Optional.empty());
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato()));
        LocacaoRepasseLancamentoEntity aluguel = vinculoAluguel(77L, "1700.00", "2026-05", LocalDate.of(2026, 5, 7));
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of(aluguel));
        when(vinculoRepository.findByOrigemAluguelVinculo_IdAndPapel(77L, PapelReconciliacao.REPASSE))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.gerarRepassesInternosContrato(CONTRATO_ID, "2026-05"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CONTA ZERO");

        verify(lancamentoRepository, never()).save(any(LancamentoFinanceiroEntity.class));
    }

    @Test
    void matrizCompetenciasMarcaMesComAluguelComoVinculado() {
        when(contratoLocacaoRepository.findById(CONTRATO_ID)).thenReturn(Optional.of(contrato()));
        LancamentoFinanceiroEntity lanc =
                lancamento(10L, NaturezaLancamento.CREDITO, "1700.00", LocalDate.of(2026, 5, 7), "ALUGUEL");
        LocacaoRepasseLancamentoEntity aluguel = vinculoAluguel(77L, "1700.00", "2026-05", LocalDate.of(2026, 5, 7));
        aluguel.setLancamentoFinanceiro(lanc);
        when(vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(CONTRATO_ID))
                .thenReturn(List.of(aluguel));
        lenient().when(lancamentoRepository.findByProcessoId(PROCESSO_ID)).thenReturn(List.of());
        lenient().when(lancamentoRepository.findOrfaosNoIntervalo(any(), any())).thenReturn(List.of());

        MatrizCompetenciasResponse mat = service.matrizCompetencias(CONTRATO_ID, 3);

        assertThat(mat.meses()).isNotEmpty();
        var maio = mat.meses().stream().filter(m -> "2026-05".equals(m.competencia())).findFirst();
        assertThat(maio).isPresent();
        assertThat(maio.get().estado()).isEqualTo("VINCULADO");
        assertThat(maio.get().aluguelVinculado()).isNotNull();
        assertThat(maio.get().aluguelVinculado().lancamentoFinanceiroId()).isEqualTo(10L);
    }

    // ------------------------------------------------------------------ auto-conciliação Cora

    @Test
    void conciliarAlugueisAutomaticoVinculaQuandoUmCreditoNaFaixa() {
        ContratoLocacaoEntity contrato = contratoTerceiro();
        contrato.getImovel().setNumeroPlanilha(42);
        when(contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(
                        eq("2026-06"), eq(LocalDate.of(2026, 6, 1)), eq(LocalDate.of(2026, 6, 30))))
                .thenReturn(List.of(contrato));

        LancamentoFinanceiroEntity credito =
                lancamento(10L, NaturezaLancamento.CREDITO, "1000.00", LocalDate.of(2026, 6, 5), "ALUGUEL");
        credito.setProcesso(processoComId(PROCESSO_ID));
        credito.setNumeroBanco(26);
        when(lancamentoRepository.findCreditosCoraSemVinculoAluguelNoContrato(
                        eq(26), eq(PROCESSO_ID), eq(CONTRATO_ID),
                        eq(LocalDate.of(2026, 6, 1)), eq(LocalDate.of(2026, 6, 30))))
                .thenReturn(List.of(credito));
        when(vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, 10L, PapelReconciliacao.ALUGUEL))
                .thenReturn(Optional.empty());
        when(vinculoRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 88L));

        ConciliarAlugueisAutomaticoResponse resp = service.conciliarAlugueisAutomatico("2026-06");

        assertThat(resp.getAutoVinculados()).isEqualTo(1);
        assertThat(resp.getParaRevisao()).isEmpty();
        assertThat(resp.getSemCredito()).isEmpty();
        ArgumentCaptor<LocacaoRepasseLancamentoEntity> captor =
                ArgumentCaptor.forClass(LocacaoRepasseLancamentoEntity.class);
        verify(vinculoRepository).save(captor.capture());
        assertThat(captor.getValue().getOrigem()).isEqualTo(LocacaoReconciliacaoService.ORIGEM_VINCULO_AUTO);
        assertThat(captor.getValue().getPapel()).isEqualTo(PapelReconciliacao.ALUGUEL);
    }

    @Test
    void conciliarAlugueisAutomaticoMarcaParaRevisaoQuandoMultiplosCreditosNaFaixa() {
        ContratoLocacaoEntity contrato = contratoTerceiro();
        when(contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(
                        eq("2026-06"), any(), any()))
                .thenReturn(List.of(contrato));

        LancamentoFinanceiroEntity c1 =
                lancamento(10L, NaturezaLancamento.CREDITO, "1000.00", LocalDate.of(2026, 6, 5), "ALUGUEL");
        LancamentoFinanceiroEntity c2 =
                lancamento(11L, NaturezaLancamento.CREDITO, "990.00", LocalDate.of(2026, 6, 8), "ALUGUEL");
        when(lancamentoRepository.findCreditosCoraSemVinculoAluguelNoContrato(
                        eq(26), eq(PROCESSO_ID), eq(CONTRATO_ID), any(), any()))
                .thenReturn(List.of(c1, c2));

        ConciliarAlugueisAutomaticoResponse resp = service.conciliarAlugueisAutomatico("2026-06");

        assertThat(resp.getAutoVinculados()).isZero();
        assertThat(resp.getParaRevisao()).hasSize(1);
        assertThat(resp.getParaRevisao().get(0).motivo()).isEqualTo("MULTIPLOS_CREDITOS_NA_FAIXA");
        verify(vinculoRepository, never()).save(any());
    }

    // ------------------------------------------------------------------ sugestões de aluguel pendente

    @Test
    void sugerirAlugueisPendentesCasaOrfaoPeloNomeDoInquilino() {
        ContratoLocacaoEntity contrato = contratoTerceiro();
        contrato.setInquilinoPessoa(pessoa("Maria Jose da Silva"));
        contrato.getImovel().setNumeroPlanilha(42);
        when(contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(
                        eq("2026-06"), eq(LocalDate.of(2026, 6, 1)), eq(LocalDate.of(2026, 6, 30))))
                .thenReturn(List.of(contrato));

        LancamentoFinanceiroEntity pix = lancamento(
                77L, NaturezaLancamento.CREDITO, "1000.00", LocalDate.of(2026, 6, 9),
                "PIX RECEBIDO MARIA JOSE DA SILVA");
        pix.setNumeroBanco(26);
        when(lancamentoRepository.findOrfaosNoIntervalo(
                        eq(LocalDate.of(2026, 6, 1)), eq(LocalDate.of(2026, 6, 30))))
                .thenReturn(List.of(pix));
        when(lancamentoRepository.findCreditosCoraSemVinculoAluguelNoContrato(
                        eq(26), eq(PROCESSO_ID), eq(CONTRATO_ID), any(), any()))
                .thenReturn(List.of());

        var resp = service.sugerirAlugueisPendentes("2026-06");

        assertThat(resp.totalContratosPendentes()).isEqualTo(1);
        assertThat(resp.totalComSugestao()).isEqualTo(1);
        var item = resp.contratos().get(0);
        assertThat(item.contratoId()).isEqualTo(CONTRATO_ID);
        assertThat(item.inquilinoNome()).isEqualTo("Maria Jose da Silva");
        assertThat(item.sugestoes()).hasSize(1);
        var s = item.sugestoes().get(0);
        assertThat(s.lancamentoFinanceiroId()).isEqualTo(77L);
        assertThat(s.origemCandidato()).isEqualTo("ORFAO");
        assertThat(s.confianca()).isEqualTo("ALTA");
        assertThat(s.nomeConfere()).isTrue();
        assertThat(s.valorConfere()).isTrue();
        // read-only: nada gravado
        verify(vinculoRepository, never()).save(any());
    }

    @Test
    void sugerirAlugueisPendentesNaoSugereOrfaoSoPorValorComDiaDistante() {
        ContratoLocacaoEntity contrato = contratoTerceiro(); // aluguel 1000, vencimento dia 10
        contrato.setInquilinoPessoa(pessoa("Sergio Gonzaga"));
        when(contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(eq("2026-06"), any(), any()))
                .thenReturn(List.of(contrato));

        LancamentoFinanceiroEntity outroPagador = lancamento(
                78L, NaturezaLancamento.CREDITO, "1000.00", LocalDate.of(2026, 6, 25),
                "PIX RECEBIDO FULANO DE TAL");
        when(lancamentoRepository.findOrfaosNoIntervalo(any(), any())).thenReturn(List.of(outroPagador));
        when(lancamentoRepository.findCreditosCoraSemVinculoAluguelNoContrato(
                        eq(26), eq(PROCESSO_ID), eq(CONTRATO_ID), any(), any()))
                .thenReturn(List.of());

        var resp = service.sugerirAlugueisPendentes("2026-06");

        assertThat(resp.totalComSugestao()).isZero();
        assertThat(resp.contratos().get(0).sugestoes()).isEmpty();
    }

    @Test
    void sugerirAlugueisPendentesIncluiCreditoCoraDoProcessoComoCandidato() {
        ContratoLocacaoEntity contrato = contratoTerceiro();
        contrato.setInquilinoPessoa(pessoa("Denise Cirino"));
        when(contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(eq("2026-06"), any(), any()))
                .thenReturn(List.of(contrato));
        when(lancamentoRepository.findOrfaosNoIntervalo(any(), any())).thenReturn(List.of());

        LancamentoFinanceiroEntity creditoProcesso = lancamento(
                79L, NaturezaLancamento.CREDITO, "990.00", LocalDate.of(2026, 6, 11), "TED DENISE CIRINO");
        creditoProcesso.setNumeroBanco(26);
        when(lancamentoRepository.findCreditosCoraSemVinculoAluguelNoContrato(
                        eq(26), eq(PROCESSO_ID), eq(CONTRATO_ID), any(), any()))
                .thenReturn(List.of(creditoProcesso));

        var resp = service.sugerirAlugueisPendentes("2026-06");

        assertThat(resp.totalComSugestao()).isEqualTo(1);
        var s = resp.contratos().get(0).sugestoes().get(0);
        assertThat(s.lancamentoFinanceiroId()).isEqualTo(79L);
        assertThat(s.origemCandidato()).isEqualTo("PROCESSO");
        assertThat(s.confianca()).isEqualTo("ALTA");
    }

    // ------------------------------------------------------------------ helpers

    private static final AtomicLong SEQ = new AtomicLong(1000);

    private static ContratoLocacaoEntity contrato() {
        ProcessoEntity processo = processoComId(PROCESSO_ID);
        PessoaEntity pessoaDono = pessoa("Itamar Villa Real");
        pessoaDono.setId(100L);
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(938L);
        cliente.setCodigoCliente("00000938");
        cliente.setProprio(true);
        cliente.setPessoa(pessoaDono);
        ImovelEntity imovel = new ImovelEntity();
        imovel.setId(IMOVEL_ID);
        imovel.setProcesso(processo);
        imovel.setCliente(cliente);
        imovel.setPessoa(pessoaDono);
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

    private static ContratoLocacaoEntity contratoComLocador() {
        ContratoLocacaoEntity c = contrato();
        c.setLocadorPessoa(pessoa("Maria Locadora"));
        c.setDadosBancariosRepasseJson("{\"banco\":\"341\"}");
        c.getImovel().setNumeroPlanilha(42);
        c.getImovel().setEnderecoCompleto("Rua A, 1");
        return c;
    }

    private static LocacaoRepasseLancamentoEntity vinculoComContrato(
            ContratoLocacaoEntity contrato, PapelReconciliacao papel, String valor, String competencia) {
        LocacaoRepasseLancamentoEntity v = vinculo(papel, valor, competencia);
        v.setContratoLocacao(contrato);
        return v;
    }

    private static ContratoLocacaoEntity contratoTerceiro() {
        ContratoLocacaoEntity c = contrato();
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(123L);
        cliente.setCodigoCliente("00000123");
        cliente.setProprio(false); // terceiro: repasse por banda, não interno
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

    /** Vínculo de ALUGUEL com o lançamento de crédito recebido na data informada. */
    private static LocacaoRepasseLancamentoEntity vinculoAluguel(Long id, String valor, String competencia, LocalDate data) {
        LocacaoRepasseLancamentoEntity v = new LocacaoRepasseLancamentoEntity();
        v.setId(id);
        v.setPapel(PapelReconciliacao.ALUGUEL);
        v.setCompetenciaMes(competencia);
        v.setValor(new BigDecimal(valor));
        v.setLancamentoFinanceiro(lancamento(SEQ.incrementAndGet(), NaturezaLancamento.CREDITO, valor, data, "ALUGUEL"));
        return v;
    }

    private static ContaBancariaEntity contaZero() {
        ContaBancariaEntity c = new ContaBancariaEntity();
        c.setId(19L);
        c.setNumeroBanco(19);
        c.setBancoNome("CONTA ZERO");
        c.setTipo("MANUAL");
        c.setExigeSomaZero(true);
        c.setAtivo(true);
        return c;
    }

    private static ContaContabilEntity contaI() {
        ContaContabilEntity c = new ContaContabilEntity();
        c.setId(9L);
        c.setCodigo("I");
        c.setNome("Imóveis");
        return c;
    }

    /** Débito de repasse interno (conta A, CONTA ZERO 19, par compensado). */
    private static LancamentoFinanceiroEntity debitoRepasseInterno(
            Long id, String valor, LocalDate data, String numero, Long aluguelVinculoId) {
        LancamentoFinanceiroEntity d = lancamento(id, NaturezaLancamento.DEBITO, valor, data, "Repasse interno (imóvel próprio) 2026-05");
        d.setContaContabil(contaA());
        d.setEtapa(EtapaLancamento.COMPENSADO);
        d.setNumeroBanco(19);
        d.setBancoNome("CONTA ZERO");
        d.setOrigem("AUTO");
        d.setStatus("ATIVO");
        d.setNumeroLancamento(numero);
        d.setGrupoCompensacao("AUTO-REP-" + aluguelVinculoId);
        d.setDataCompetencia(LocalDate.of(2026, 5, 1));
        return d;
    }

    private static LancamentoFinanceiroEntity creditoRepasseInterno(
            Long id, String valor, LocalDate data, String numero, Long aluguelVinculoId) {
        LancamentoFinanceiroEntity c = lancamento(id, NaturezaLancamento.CREDITO, valor, data, "Rendimento imóvel próprio 2026-05");
        c.setContaContabil(contaI());
        c.setEtapa(EtapaLancamento.COMPENSADO);
        c.setNumeroBanco(19);
        c.setBancoNome("CONTA ZERO");
        c.setOrigem("AUTO");
        c.setStatus("ATIVO");
        c.setNumeroLancamento(numero);
        c.setGrupoCompensacao("AUTO-REP-" + aluguelVinculoId);
        c.setDataCompetencia(LocalDate.of(2026, 5, 1));
        return c;
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
