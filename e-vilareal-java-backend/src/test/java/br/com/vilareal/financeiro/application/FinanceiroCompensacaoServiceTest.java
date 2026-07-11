package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.DescartarParesCompensacaoResponse;
import br.com.vilareal.financeiro.api.dto.DesparearCompensacaoResponse;
import br.com.vilareal.financeiro.api.dto.ParearCompensacaoItemRequest;
import br.com.vilareal.financeiro.api.dto.ParearCompensacaoRequest;
import br.com.vilareal.financeiro.api.dto.ParearCompensacaoResponse;
import br.com.vilareal.financeiro.api.dto.ParearGrupoCompensacaoRequest;
import br.com.vilareal.financeiro.api.dto.ParearGrupoCompensacaoResponse;
import br.com.vilareal.financeiro.api.dto.ParesSugeridosCompensacaoResponse;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
    private ContaBancariaApplicationService contaBancariaApplicationService;
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

    // --- Pareamento em grupo (CONTA ZERO) ---

    private void stubContaAcertoPorNumeroBanco19() {
        lenient()
                .when(contaBancariaApplicationService.exigeSomaZero(any(LancamentoFinanceiroEntity.class)))
                .thenAnswer(inv -> {
                    LancamentoFinanceiroEntity l = inv.getArgument(0);
                    return l.getNumeroBanco() != null && l.getNumeroBanco() == 19;
                });
    }

    private LancamentoFinanceiroEntity lancamentoContaZero(
            long id, NaturezaLancamento natureza, String valor, Long clienteId, String contaCodigo) {
        LancamentoFinanceiroEntity e = new LancamentoFinanceiroEntity();
        e.setId(id);
        e.setNumeroBanco(19);
        e.setValor(new BigDecimal(valor));
        e.setNatureza(natureza);
        e.setDataLancamento(LocalDate.of(2026, 6, 1));
        ContaContabilEntity contaA = new ContaContabilEntity();
        contaA.setId(1L);
        contaA.setCodigo(contaCodigo);
        e.setContaContabil(contaA);
        if (clienteId != null) {
            ClienteEntity c = new ClienteEntity();
            c.setId(clienteId);
            e.setClienteEntidade(c);
        }
        return e;
    }

    @Test
    void parearGrupo_contaAcerto_somaZeroEMesmoVinculo_compensaPreservandoContaContabil() {
        stubContaAcertoPorNumeroBanco19();
        LancamentoFinanceiroEntity credito = lancamentoContaZero(1L, NaturezaLancamento.CREDITO, "100.00", 729L, "A");
        LancamentoFinanceiroEntity debito1 = lancamentoContaZero(2L, NaturezaLancamento.DEBITO, "80.00", 729L, "A");
        LancamentoFinanceiroEntity debito2 = lancamentoContaZero(3L, NaturezaLancamento.DEBITO, "20.00", 729L, "A");
        when(lancamentoRepository.findAllByIdIn(any())).thenReturn(List.of(credito, debito1, debito2));
        when(lancamentoRepository.findAllByGrupoCompensacao(any())).thenReturn(List.of());
        when(lancamentoRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        ParearGrupoCompensacaoRequest req = new ParearGrupoCompensacaoRequest();
        req.setLancamentoIds(List.of(1L, 2L, 3L));

        ParearGrupoCompensacaoResponse r = service.parearGrupo(req);

        assertThat(r.getLancamentos()).isEqualTo(3);
        assertThat(r.getSoma()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(r.getGrupoCompensacao()).startsWith("COMP-");
        for (LancamentoFinanceiroEntity e : List.of(credito, debito1, debito2)) {
            assertThat(e.getGrupoCompensacao()).isEqualTo(r.getGrupoCompensacao());
            assertThat(e.getEtapa()).isEqualTo(EtapaLancamento.COMPENSADO);
            assertThat(e.getContaContabil().getCodigo()).isEqualTo("A"); // preservada, não vira E
        }
    }

    @Test
    void parearGrupo_contaAcerto_somaDiferenteDeZero_erro() {
        stubContaAcertoPorNumeroBanco19();
        LancamentoFinanceiroEntity credito = lancamentoContaZero(1L, NaturezaLancamento.CREDITO, "100.00", 729L, "A");
        LancamentoFinanceiroEntity debito = lancamentoContaZero(2L, NaturezaLancamento.DEBITO, "99.99", 729L, "A");
        when(lancamentoRepository.findAllByIdIn(any())).thenReturn(List.of(credito, debito));
        when(lancamentoRepository.findAllByGrupoCompensacao(any())).thenReturn(List.of());

        ParearGrupoCompensacaoRequest req = new ParearGrupoCompensacaoRequest();
        req.setLancamentoIds(List.of(1L, 2L));

        assertThatThrownBy(() -> service.parearGrupo(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("somar exatamente zero");
    }

    @Test
    void parearGrupo_contaAcerto_vinculosDiferentes_erro() {
        stubContaAcertoPorNumeroBanco19();
        LancamentoFinanceiroEntity credito = lancamentoContaZero(1L, NaturezaLancamento.CREDITO, "100.00", 729L, "A");
        LancamentoFinanceiroEntity debito = lancamentoContaZero(2L, NaturezaLancamento.DEBITO, "100.00", 493L, "A");
        when(lancamentoRepository.findAllByIdIn(any())).thenReturn(List.of(credito, debito));
        when(lancamentoRepository.findAllByGrupoCompensacao(any())).thenReturn(List.of());

        ParearGrupoCompensacaoRequest req = new ParearGrupoCompensacaoRequest();
        req.setLancamentoIds(List.of(1L, 2L));

        assertThatThrownBy(() -> service.parearGrupo(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("mesmo vínculo");
    }

    @Test
    void parearGrupo_contaAcerto_semVinculo_erro() {
        stubContaAcertoPorNumeroBanco19();
        LancamentoFinanceiroEntity credito = lancamentoContaZero(1L, NaturezaLancamento.CREDITO, "100.00", null, "A");
        LancamentoFinanceiroEntity debito = lancamentoContaZero(2L, NaturezaLancamento.DEBITO, "100.00", null, "A");
        when(lancamentoRepository.findAllByIdIn(any())).thenReturn(List.of(credito, debito));
        when(lancamentoRepository.findAllByGrupoCompensacao(any())).thenReturn(List.of());

        ParearGrupoCompensacaoRequest req = new ParearGrupoCompensacaoRequest();
        req.setLancamentoIds(List.of(1L, 2L));

        assertThatThrownBy(() -> service.parearGrupo(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("sem vínculo");
    }

    @Test
    void parearGrupo_misto_contaAcertoEComum_erro() {
        stubContaAcertoPorNumeroBanco19();
        LancamentoFinanceiroEntity contaZero = lancamentoContaZero(1L, NaturezaLancamento.CREDITO, "100.00", 729L, "A");
        LancamentoFinanceiroEntity comum = lancamentoOrfao(2L, 1, NaturezaLancamento.DEBITO, LocalDate.of(2026, 6, 1));
        comum.setValor(new BigDecimal("100.00"));
        when(lancamentoRepository.findAllByIdIn(any())).thenReturn(List.of(contaZero, comum));
        when(lancamentoRepository.findAllByGrupoCompensacao(any())).thenReturn(List.of());

        ParearGrupoCompensacaoRequest req = new ParearGrupoCompensacaoRequest();
        req.setLancamentoIds(List.of(1L, 2L));

        assertThatThrownBy(() -> service.parearGrupo(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("misto");
    }

    @Test
    void parearGrupo_contaComum_dentroDaTolerancia_movePraContaE() {
        stubContaAcertoPorNumeroBanco19();
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("E")).thenReturn(Optional.of(contaE));
        LancamentoFinanceiroEntity d = lancamentoOrfao(1L, 1, NaturezaLancamento.DEBITO, LocalDate.of(2026, 6, 1), contaN());
        LancamentoFinanceiroEntity c = lancamentoOrfao(2L, 2, NaturezaLancamento.CREDITO, LocalDate.of(2026, 6, 1), contaN());
        when(lancamentoRepository.findAllByIdIn(any())).thenReturn(List.of(d, c));
        when(lancamentoRepository.findAllByGrupoCompensacao(any())).thenReturn(List.of());
        when(lancamentoRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        ParearGrupoCompensacaoRequest req = new ParearGrupoCompensacaoRequest();
        req.setLancamentoIds(List.of(1L, 2L));

        ParearGrupoCompensacaoResponse r = service.parearGrupo(req);

        assertThat(r.getLancamentos()).isEqualTo(2);
        assertThat(d.getContaContabil().getCodigo()).isEqualTo("E");
        assertThat(c.getContaContabil().getCodigo()).isEqualTo("E");
        assertThat(d.getEtapa()).isEqualTo(EtapaLancamento.COMPENSADO);
    }

    @Test
    void parearGrupo_lancamentoJaAgrupado_erro() {
        LancamentoFinanceiroEntity credito = lancamentoContaZero(1L, NaturezaLancamento.CREDITO, "100.00", 729L, "A");
        credito.setGrupoCompensacao("COMP-abc");
        LancamentoFinanceiroEntity debito = lancamentoContaZero(2L, NaturezaLancamento.DEBITO, "100.00", 729L, "A");
        when(lancamentoRepository.findAllByIdIn(any())).thenReturn(List.of(credito, debito));

        ParearGrupoCompensacaoRequest req = new ParearGrupoCompensacaoRequest();
        req.setLancamentoIds(List.of(1L, 2L));

        assertThatThrownBy(() -> service.parearGrupo(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("já pertence ao grupo");
    }

    @Test
    void desparear_contaAcerto_preservaContaContabil() {
        stubContaAcertoPorNumeroBanco19();
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("N")).thenReturn(Optional.of(contaN()));
        LancamentoFinanceiroEntity credito = lancamentoContaZero(1L, NaturezaLancamento.CREDITO, "100.00", 729L, "A");
        LancamentoFinanceiroEntity debito = lancamentoContaZero(2L, NaturezaLancamento.DEBITO, "100.00", 729L, "A");
        credito.setGrupoCompensacao("COMP-cz1");
        debito.setGrupoCompensacao("COMP-cz1");
        when(lancamentoRepository.findAllByGrupoCompensacao("COMP-cz1")).thenReturn(List.of(credito, debito));
        when(lancamentoRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        DesparearCompensacaoResponse r = service.desparear("COMP-cz1");

        assertThat(r.getDesvinculados()).isEqualTo(2);
        assertThat(credito.getGrupoCompensacao()).isNull();
        assertThat(credito.getContaContabil().getCodigo()).isEqualTo("A"); // não vira N
        assertThat(credito.getEtapa()).isEqualTo(EtapaLancamento.VINCULADO); // A + cliente
    }

    @Test
    void parear_parNaContaAcerto_exigeSomaExataEPreservaConta() {
        stubContaAcertoPorNumeroBanco19();
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("E")).thenReturn(Optional.of(contaE));
        LancamentoFinanceiroEntity credito = lancamentoContaZero(1L, NaturezaLancamento.CREDITO, "100.00", 729L, "A");
        LancamentoFinanceiroEntity debito = lancamentoContaZero(2L, NaturezaLancamento.DEBITO, "98.00", 729L, "A");
        when(lancamentoRepository.findById(1L)).thenReturn(Optional.of(credito));
        when(lancamentoRepository.findById(2L)).thenReturn(Optional.of(debito));

        ParearCompensacaoItemRequest item = new ParearCompensacaoItemRequest();
        item.setLancamentoIdA(1L);
        item.setLancamentoIdB(2L);
        ParearCompensacaoRequest req = new ParearCompensacaoRequest();
        req.setPares(List.of(item));

        // 98 vs 100 passaria na tolerância de 5%, mas na conta de acerto exige soma exata → erro
        ParearCompensacaoResponse r = service.parear(req);
        assertThat(r.getPareados()).isZero();
        assertThat(r.getErros()).hasSize(1);

        debito.setValor(new BigDecimal("100.00"));
        when(lancamentoRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        ParearCompensacaoResponse ok = service.parear(req);
        assertThat(ok.getPareados()).isEqualTo(1);
        assertThat(credito.getContaContabil().getCodigo()).isEqualTo("A"); // preservada
        assertThat(credito.getEtapa()).isEqualTo(EtapaLancamento.COMPENSADO);
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
