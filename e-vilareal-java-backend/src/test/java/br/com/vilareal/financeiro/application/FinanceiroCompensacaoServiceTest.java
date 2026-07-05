package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.DescartarParesCompensacaoResponse;
import br.com.vilareal.financeiro.api.dto.ParearCompensacaoItemRequest;
import br.com.vilareal.financeiro.api.dto.ParearCompensacaoRequest;
import br.com.vilareal.financeiro.api.dto.ParearCompensacaoResponse;
import br.com.vilareal.financeiro.api.dto.ParesSugeridosCompensacaoResponse;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.domain.TipoParCompensacao;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.CompensacaoParDescarteEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.CompensacaoParDescarteRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class FinanceiroCompensacaoServiceTest {

    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private ContaContabilRepository contaContabilRepository;
    @Mock
    private CompensacaoParDescarteRepository compensacaoParDescarteRepository;
    @Mock
    private FinanceiroSaudeService financeiroSaudeService;

    @InjectMocks
    private FinanceiroCompensacaoService service;

    private ContaContabilEntity contaE;
    private LancamentoFinanceiroEntity debito;
    private LancamentoFinanceiroEntity credito;

    @BeforeEach
    void setUp() {
        lenient().when(compensacaoParDescarteRepository.findAll()).thenReturn(List.of());
        contaE = new ContaContabilEntity();
        contaE.setId(6L);
        contaE.setCodigo("E");
        contaE.setNome("Conta Compensação");

        debito = new LancamentoFinanceiroEntity();
        debito.setId(1L);
        debito.setValor(new BigDecimal("1000.00"));
        debito.setNatureza(NaturezaLancamento.DEBITO);
        debito.setDataLancamento(LocalDate.of(2026, 3, 1));
        debito.setContaContabil(contaN());

        credito = new LancamentoFinanceiroEntity();
        credito.setId(2L);
        credito.setValor(new BigDecimal("1000.00"));
        credito.setNatureza(NaturezaLancamento.CREDITO);
        credito.setDataLancamento(LocalDate.of(2026, 3, 1));
        credito.setContaContabil(contaN());
    }

    private static ContaContabilEntity contaN() {
        ContaContabilEntity n = new ContaContabilEntity();
        n.setId(5L);
        n.setCodigo("N");
        return n;
    }

    @Test
    void parear_parValido_atualizaContaEGrupoECompensado() {
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("E")).thenReturn(Optional.of(contaE));
        when(lancamentoRepository.findById(1L)).thenReturn(Optional.of(debito));
        when(lancamentoRepository.findById(2L)).thenReturn(Optional.of(credito));
        when(lancamentoRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        ParearCompensacaoItemRequest item = new ParearCompensacaoItemRequest();
        item.setLancamentoIdA(1L);
        item.setLancamentoIdB(2L);
        ParearCompensacaoRequest req = new ParearCompensacaoRequest();
        req.setPares(List.of(item));

        ParearCompensacaoResponse r = service.parear(req);

        assertThat(r.getPareados()).isEqualTo(1);
        assertThat(r.getErros()).isEmpty();
        assertThat(r.getGruposGerados()).hasSize(1);

        ArgumentCaptor<List<LancamentoFinanceiroEntity>> cap = ArgumentCaptor.forClass(List.class);
        verify(lancamentoRepository).saveAll(cap.capture());
        for (LancamentoFinanceiroEntity e : cap.getValue()) {
            assertThat(e.getContaContabil().getCodigo()).isEqualTo("E");
            assertThat(e.getGrupoCompensacao()).startsWith("COMP-");
            assertThat(e.getEtapa()).isEqualTo(EtapaLancamento.COMPENSADO);
        }
    }

    @Test
    void parear_somaForaTolerancia_registraErro() {
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("E")).thenReturn(Optional.of(contaE));
        credito.setValor(new BigDecimal("2000.00"));
        when(lancamentoRepository.findById(1L)).thenReturn(Optional.of(debito));
        when(lancamentoRepository.findById(2L)).thenReturn(Optional.of(credito));

        ParearCompensacaoItemRequest item = new ParearCompensacaoItemRequest();
        item.setLancamentoIdA(1L);
        item.setLancamentoIdB(2L);
        ParearCompensacaoRequest req = new ParearCompensacaoRequest();
        req.setPares(List.of(item));

        ParearCompensacaoResponse r = service.parear(req);

        assertThat(r.getPareados()).isZero();
        assertThat(r.getErros()).hasSize(1);
    }

    @Test
    void listarParesSugeridos_priorizaPixInterbancarioSobreDepositoMesmoBanco() {
        LocalDate dia = LocalDate.of(2026, 4, 24);
        LancamentoFinanceiroEntity bbPix = lancamentoOrfao(10L, 2, NaturezaLancamento.DEBITO, dia);
        bbPix.setDescricao("Pix - Enviado");
        bbPix.setValor(new BigDecimal("10934.30"));
        LancamentoFinanceiroEntity bbDeposito = lancamentoOrfao(20L, 2, NaturezaLancamento.CREDITO, dia);
        bbDeposito.setDescricao("Credito Deposito Judicial");
        bbDeposito.setValor(new BigDecimal("10934.30"));
        LancamentoFinanceiroEntity itauPix = lancamentoOrfao(30L, 1, NaturezaLancamento.CREDITO, dia);
        itauPix.setDescricao("PIX TRANSF ITAMAR 24/04");
        itauPix.setValor(new BigDecimal("10934.30"));

        when(lancamentoRepository.countParesCompensacaoSugeridos(
                        anyBoolean(), anyList(), any(), any(), eq(3), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean()))
                .thenReturn(2L);
        when(lancamentoRepository.findParesCompensacaoSugeridosIds(
                        anyBoolean(), anyList(), any(), any(), eq(3), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean(), anyInt(), anyInt()))
                .thenReturn(
                        List.<Object[]>of(new Object[] {10L, 20L, 2, 2}, new Object[] {10L, 30L, 2, 1}),
                        List.of());
        when(lancamentoRepository.findAllByIdIn(any())).thenReturn(List.of(bbPix, bbDeposito, itauPix));

        ParesSugeridosCompensacaoResponse r =
                service.listarParesSugeridos(null, 2026, 4, 0, 50, false, false, false, false);

        assertThat(r.getTotalPares()).isEqualTo(1);
        assertThat(r.getPares()).hasSize(1);
        assertThat(r.getPares().get(0).getTipo()).isEqualTo(TipoParCompensacao.INTERBANCARIO);
        assertThat(r.getPares().get(0).getLancamentoA().getId()).isEqualTo(10L);
        assertThat(r.getPares().get(0).getLancamentoB().getId()).isEqualTo(30L);
    }

    @Test
    void listarParesSugeridos_filtraPorMesmoDiaUtilBancario() {
        LocalDate sexta = LocalDate.of(2025, 3, 14);
        LocalDate segunda = LocalDate.of(2025, 3, 17);
        LocalDate quinta = LocalDate.of(2025, 3, 13);

        LancamentoFinanceiroEntity itau = lancamentoOrfao(10L, 1, NaturezaLancamento.DEBITO, sexta);
        LancamentoFinanceiroEntity pay99 = lancamentoOrfao(20L, 30, NaturezaLancamento.CREDITO, segunda);
        LancamentoFinanceiroEntity outro = lancamentoOrfao(30L, 2, NaturezaLancamento.CREDITO, quinta);

        when(lancamentoRepository.countParesCompensacaoSugeridos(
                        anyBoolean(), anyList(), any(), any(), eq(3), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean()))
                .thenReturn(2L);
        when(lancamentoRepository.findParesCompensacaoSugeridosIds(
                        anyBoolean(), anyList(), any(), any(), eq(3), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean(), anyInt(), anyInt()))
                .thenReturn(
                        List.<Object[]>of(new Object[] {10L, 20L, 1, 30}, new Object[] {10L, 30L, 1, 2}),
                        List.of());
        when(lancamentoRepository.findAllByIdIn(any())).thenReturn(List.of(itau, pay99, outro));

        ParesSugeridosCompensacaoResponse r =
                service.listarParesSugeridos(null, null, null, 0, 50, true, false, false, false);

        assertThat(r.getTotalPares()).isEqualTo(1);
        assertThat(r.getPares()).hasSize(1);
        assertThat(r.getPares().get(0).getLancamentoA().getId()).isEqualTo(10L);
        assertThat(r.getPares().get(0).getLancamentoB().getId()).isEqualTo(20L);
    }

    @Test
    void listarParesSugeridos_ignoraLancamentosSemLetraE() {
        LocalDate dia = LocalDate.of(2026, 4, 24);
        LancamentoFinanceiroEntity bbPix = lancamentoOrfao(10L, 2, NaturezaLancamento.DEBITO, dia, contaN());
        LancamentoFinanceiroEntity itauPix = lancamentoOrfao(30L, 1, NaturezaLancamento.CREDITO, dia, contaN());

        when(lancamentoRepository.countParesCompensacaoSugeridos(
                        anyBoolean(), anyList(), any(), any(), eq(3), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean()))
                .thenReturn(1L);
        when(lancamentoRepository.findParesCompensacaoSugeridosIds(
                        anyBoolean(), anyList(), any(), any(), eq(3), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean(), anyInt(), anyInt()))
                .thenReturn(List.<Object[]>of(new Object[] {10L, 30L, 2, 1}), List.of());
        when(lancamentoRepository.findAllByIdIn(any())).thenReturn(List.of(bbPix, itauPix));

        ParesSugeridosCompensacaoResponse r =
                service.listarParesSugeridos(null, 2026, 4, 0, 50, false, false, false, false);

        assertThat(r.getTotalPares()).isZero();
        assertThat(r.getPares()).isEmpty();
    }

    @Test
    void listarParesSugeridos_paginaRetornaSubconjunto() {
        LocalDate dia = LocalDate.of(2026, 5, 10);
        LancamentoFinanceiroEntity d1 = lancamentoOrfao(1L, 1, NaturezaLancamento.DEBITO, dia);
        LancamentoFinanceiroEntity c1 = lancamentoOrfao(2L, 2, NaturezaLancamento.CREDITO, dia);
        LancamentoFinanceiroEntity d2 = lancamentoOrfao(3L, 1, NaturezaLancamento.DEBITO, dia);
        LancamentoFinanceiroEntity c2 = lancamentoOrfao(4L, 2, NaturezaLancamento.CREDITO, dia);

        when(lancamentoRepository.countParesCompensacaoSugeridos(
                        anyBoolean(), anyList(), any(), any(), eq(3), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean()))
                .thenReturn(2L);
        when(lancamentoRepository.findParesCompensacaoSugeridosIds(
                        anyBoolean(), anyList(), any(), any(), eq(3), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean(), anyInt(), anyInt()))
                .thenReturn(
                        List.<Object[]>of(new Object[] {1L, 2L, 1, 2}, new Object[] {3L, 4L, 1, 2}),
                        List.of());
        when(lancamentoRepository.findAllByIdIn(any())).thenReturn(List.of(d1, c1, d2, c2));

        ParesSugeridosCompensacaoResponse p0 =
                service.listarParesSugeridos(null, null, null, 0, 1, false, false, false, false);
        ParesSugeridosCompensacaoResponse p1 =
                service.listarParesSugeridos(null, null, null, 1, 1, false, false, false, false);

        assertThat(p0.getTotalPares()).isEqualTo(2);
        assertThat(p0.getPares()).hasSize(1);
        assertThat(p1.getPares()).hasSize(1);
        assertThat(p0.getPares().get(0).getLancamentoA().getId()).isNotEqualTo(
                p1.getPares().get(0).getLancamentoA().getId());
    }

    @Test
    void descartarPares_persisteRejeicaoENormalizaIds() {
        when(compensacaoParDescarteRepository.existsByLancamentoIdMenorAndLancamentoIdMaior(1L, 2L))
                .thenReturn(false);
        when(compensacaoParDescarteRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ParearCompensacaoItemRequest item = new ParearCompensacaoItemRequest();
        item.setLancamentoIdA(2L);
        item.setLancamentoIdB(1L);
        ParearCompensacaoRequest req = new ParearCompensacaoRequest();
        req.setPares(List.of(item));

        DescartarParesCompensacaoResponse r = service.descartarPares(req);

        assertThat(r.getDescartados()).isEqualTo(1);
        ArgumentCaptor<CompensacaoParDescarteEntity> cap = ArgumentCaptor.forClass(CompensacaoParDescarteEntity.class);
        verify(compensacaoParDescarteRepository).save(cap.capture());
        assertThat(cap.getValue().getLancamentoIdMenor()).isEqualTo(1L);
        assertThat(cap.getValue().getLancamentoIdMaior()).isEqualTo(2L);
        verify(financeiroSaudeService).invalidarCacheSaude();
    }

    private static LancamentoFinanceiroEntity lancamentoOrfao(
            long id, int numeroBanco, NaturezaLancamento natureza, LocalDate data) {
        return lancamentoOrfao(id, numeroBanco, natureza, data, contaE());
    }

    private static LancamentoFinanceiroEntity lancamentoOrfao(
            long id,
            int numeroBanco,
            NaturezaLancamento natureza,
            LocalDate data,
            ContaContabilEntity conta) {
        LancamentoFinanceiroEntity e = new LancamentoFinanceiroEntity();
        e.setId(id);
        e.setNumeroBanco(numeroBanco);
        e.setValor(new BigDecimal("500.00"));
        e.setNatureza(natureza);
        e.setDataLancamento(data);
        e.setContaContabil(conta);
        e.setEtapa(EtapaLancamento.CLASSIFICADO);
        return e;
    }

    private static ContaContabilEntity contaE() {
        ContaContabilEntity e = new ContaContabilEntity();
        e.setId(6L);
        e.setCodigo("E");
        return e;
    }
}
