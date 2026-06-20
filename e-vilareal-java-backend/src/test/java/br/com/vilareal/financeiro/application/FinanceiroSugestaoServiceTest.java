package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.SugestaoClassificacaoResponse;
import br.com.vilareal.financeiro.domain.DescricaoNormalizer;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.domain.OrigemSugestao;
import br.com.vilareal.financeiro.domain.TipoMatch;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.RegraClassificacaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.RegraClassificacaoRepository;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.api.dto.ProcessoPartesVinculoTexto;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FinanceiroSugestaoServiceTest {

    @Mock
    private RegraClassificacaoRepository regraRepository;
    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private ContaContabilRepository contaContabilRepository;
    @Mock
    private PessoaRepository pessoaRepository;
    @Mock
    private ProcessoRepository processoRepository;
    @Mock
    private ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    @Mock
    private ProcessoApplicationService processoApplicationService;
    @Mock
    private FinanceiroSaudeService financeiroSaudeService;
    @Mock
    private ClienteResolverService clienteResolverService;
    @Mock
    private br.com.vilareal.imovel.application.LocacaoReconciliacaoService locacaoReconciliacaoService;

    @InjectMocks
    private FinanceiroSugestaoService service;

    private ContaContabilEntity contaA;
    private ContaContabilEntity contaE;
    private ContaContabilEntity contaI;
    private ContaContabilEntity contaN;
    private LancamentoFinanceiroEntity lancamento;

    @BeforeEach
    void setUp() {
        contaN = new ContaContabilEntity();
        contaN.setId(5L);
        contaN.setCodigo("N");
        contaN.setNome("Conta Não Identificados");

        contaE = new ContaContabilEntity();
        contaE.setId(6L);
        contaE.setCodigo("E");
        contaE.setNome("Conta Compensação");

        contaA = new ContaContabilEntity();
        contaA.setId(7L);
        contaA.setCodigo("A");
        contaA.setNome("Conta Cliente");

        contaI = new ContaContabilEntity();
        contaI.setId(8L);
        contaI.setCodigo("I");
        contaI.setNome("Conta Imóveis");

        lancamento = new LancamentoFinanceiroEntity();
        lancamento.setId(99L);
        lancamento.setContaContabil(contaN);
        lancamento.setEtapa(EtapaLancamento.IMPORTADO);
        lancamento.setNumeroBanco(1);
        lenient()
                .when(clienteCodigoPessoaResolver.codigoClienteExibicaoParaPessoaId(anyLong()))
                .thenAnswer(inv -> String.format("COD-%d", inv.getArgument(0, Long.class)));
        lenient()
                .when(processoApplicationService.resolverTextosPartesVinculoEmLote(anySet()))
                .thenReturn(Map.of());

        lancamento.setDescricao("PAGTO CARTAO PERSONNALITE");
        lancamento.setValor(new BigDecimal("1500.00"));
        lancamento.setNatureza(NaturezaLancamento.DEBITO);
        lancamento.setDataLancamento(LocalDate.of(2026, 3, 15));
        lancamento.setNumeroLancamento("PL-test");

        lenient()
                .when(lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(any(), any(), any(), any()))
                .thenReturn(List.of());
        lenient()
                .when(lancamentoRepository.contarContaPorDescricaoHistoricoPosterior(any(), any(), any(), any()))
                .thenReturn(List.of());
        lenient()
                .when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(
                        any(), any(), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());
        lenient()
                .when(lancamentoRepository.findRecorrenciaCandidatosPosteriores(
                        any(), any(), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());
        lenient()
                .when(lancamentoRepository.findDepositosIdentificadosPorCpfAnteriores(
                        any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(List.of());
        lenient()
                .when(lancamentoRepository.findDepositosIdentificadosPorCpfPosteriores(
                        any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(List.of());
    }

    @Test
    void sugerir_corJursCri_sugereContaF() {
        lancamento.setDescricao("COR JURS CRI Brookfield");
        lancamento.setNatureza(NaturezaLancamento.CREDITO);

        ContaContabilEntity contaF = new ContaContabilEntity();
        contaF.setId(8L);
        contaF.setCodigo("F");
        contaF.setNome("Rendimentos");

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("F")).thenReturn(Optional.of(contaF));
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(any(), any(), any(), any())).thenReturn(List.of());
        when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(any(), any(), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).isNotEmpty();
        assertThat(sugestoes.get(0).getContaCodigo()).isEqualTo("F");
        assertThat(sugestoes.get(0).getConfianca()).isEqualTo(ConfiancaSugestao.ALTA);
        assertThat(sugestoes.get(0).getOrigem()).isEqualTo(OrigemSugestao.REGRA);
    }

    @Test
    void sugerir_camadaRegra_contemPersonnalite() {
        RegraClassificacaoEntity regra = new RegraClassificacaoEntity();
        regra.setId(1L);
        regra.setPadraoDescricao("PERSONNALITE");
        regra.setTipoMatch(TipoMatch.CONTAINS);
        regra.setContaContabil(contaE);
        regra.setPrioridade(10);
        regra.setConfianca(new BigDecimal("0.99"));
        regra.setAtivo(true);

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of(regra));
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(any(), any(), any(), any())).thenReturn(List.of());
        when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(any(), any(), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).isNotEmpty();
        SugestaoClassificacaoResponse primeira = sugestoes.get(0);
        assertThat(primeira.getContaCodigo()).isEqualTo("E");
        assertThat(primeira.getConfianca()).isEqualTo(ConfiancaSugestao.ALTA);
        assertThat(primeira.getOrigem()).isEqualTo(OrigemSugestao.REGRA);
        assertThat(primeira.getRegraId()).isEqualTo(1L);
    }

    @Test
    void sugerir_naoRetornaContaNemDoHistorico() {
        ContaContabilEntity contaN = new ContaContabilEntity();
        contaN.setId(5L);
        contaN.setCodigo("N");
        contaN.setNome("Não classificado");

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(1, DescricaoNormalizer.normalizar(lancamento.getDescricao()), lancamento.getDataLancamento(), 99L))
                .thenReturn(List.<Object[]>of(new Object[] {5L, 10L}));
        when(contaContabilRepository.findById(5L)).thenReturn(Optional.of(contaN));
        when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(any(), any(), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).isEmpty();
    }

    @Test
    void sugerir_camadaHistorico_mediaQuandoTresOuMais() {
        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(1, DescricaoNormalizer.normalizar(lancamento.getDescricao()), lancamento.getDataLancamento(), 99L))
                .thenReturn(List.<Object[]>of(new Object[] {6L, 5L}));
        when(contaContabilRepository.findById(6L)).thenReturn(Optional.of(contaE));
        when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(any(), any(), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).anyMatch(s ->
                s.getOrigem() == OrigemSugestao.HISTORICO
                        && s.getConfianca() == ConfiancaSugestao.MEDIA
                        && s.getOcorrencias() == 5L);
    }

    @Test
    void sugerir_camadaDepositoIdentificado_priorizaContaAComClienteProc() {
        lancamento.setDescricao(
                "Pagamento recebido - Luciana Mendonça Gomides De Carvalho - 764.677.911-34");
        lancamento.setNatureza(NaturezaLancamento.CREDITO);
        lancamento.setValor(new BigDecimal("506.00"));

        PessoaEntity pagador = new PessoaEntity();
        pagador.setId(900L);
        pagador.setNome("Luciana Mendonça Gomides De Carvalho");
        pagador.setCpf("76467791134");

        PessoaEntity titular = new PessoaEntity();
        titular.setId(728L);
        titular.setNome("Cliente Titular");

        ClienteEntity cliente728 = new ClienteEntity();
        cliente728.setId(99L);
        cliente728.setCodigoCliente("00000728");
        cliente728.setPessoa(titular);

        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(50L);
        processo.setPessoa(titular);
        processo.setCliente(cliente728);
        processo.setNumeroInterno(12);

        LancamentoFinanceiroEntity anterior = new LancamentoFinanceiroEntity();
        anterior.setId(10L);
        anterior.setContaContabil(contaA);
        anterior.setPessoaRef(titular);
        anterior.setClienteEntidade(cliente728);
        anterior.setProcesso(processo);
        anterior.setDataLancamento(LocalDate.of(2026, 4, 10));

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(pessoaRepository.findByCpf("76467791134")).thenReturn(Optional.of(pagador));
        when(lancamentoRepository.findDepositosIdentificadosPorCpfAnteriores(
                        eq("76467791134"), eq(99L), eq(EtapaLancamento.IMPORTADO), eq(lancamento.getDataLancamento()), any(Pageable.class)))
                .thenReturn(List.of(anterior));
        when(lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(any(), any(), any(), any())).thenReturn(List.of());
        when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(any(), any(), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());
        when(processoApplicationService.resolverTextosPartesVinculoEmLote(Set.of(50L)))
                .thenReturn(
                        Map.of(
                                50L,
                                new ProcessoPartesVinculoTexto(
                                        "Itamar Villa Real", "Ana Luisa")));

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).isNotEmpty();
        SugestaoClassificacaoResponse primeira = sugestoes.get(0);
        assertThat(primeira.getOrigem()).isEqualTo(OrigemSugestao.DEPOSITO_IDENTIFICADO);
        assertThat(primeira.getContaCodigo()).isEqualTo("A");
        assertThat(primeira.getClienteId()).isEqualTo(99L);
        assertThat(primeira.getPessoaRefId()).isEqualTo(728L);
        assertThat(primeira.getProcessoId()).isEqualTo(50L);
        assertThat(primeira.getRotuloVinculo())
                .isEqualTo("COD-728 · proc 12 - Itamar Villa Real x Ana Luisa");
    }

    @Test
    void sugerir_camadaPessoaProcessos_quandoSemDepositoAnterior() {
        lancamento.setDescricao(
                "Pagamento recebido - Luciana Mendonça Gomides De Carvalho - 764.677.911-34");

        PessoaEntity pagador = new PessoaEntity();
        pagador.setId(900L);
        pagador.setNome("Luciana Mendonça Gomides De Carvalho");
        pagador.setCpf("76467791134");

        PessoaEntity titular = new PessoaEntity();
        titular.setId(728L);

        ClienteEntity cliente728 = new ClienteEntity();
        cliente728.setId(99L);
        cliente728.setCodigoCliente("00000728");
        cliente728.setPessoa(titular);

        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(50L);
        processo.setPessoa(titular);
        processo.setCliente(cliente728);
        processo.setNumeroInterno(3);

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(pessoaRepository.findByCpf("76467791134")).thenReturn(Optional.of(pagador));
        when(clienteResolverService.resolverClienteParaTitular(728L)).thenReturn(cliente728);
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("A")).thenReturn(Optional.of(contaA));
        when(processoRepository.findAllDistinctVinculadosPessoa(900L)).thenReturn(List.of(processo));
        when(processoApplicationService.resolverTextosPartesVinculoEmLote(Set.of(50L)))
                .thenReturn(
                        Map.of(
                                50L,
                                new ProcessoPartesVinculoTexto(
                                        "Itamar Villa Real", "Ana Luisa")));
        when(lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(any(), any(), any(), any())).thenReturn(List.of());
        when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(any(), any(), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).anyMatch(s ->
                s.getOrigem() == OrigemSugestao.PESSOA_PROCESSO
                        && "A".equals(s.getContaCodigo())
                        && s.getProcessoId().equals(50L)
                        && "COD-728 · proc 3 - Itamar Villa Real x Ana Luisa".equals(s.getRotuloVinculo()));
    }

    @Test
    void sugerir_camadaPessoaProcessos_parteOpostaSemCpf_sugerePorNomeNaDescricao() {
        lancamento.setDescricao("PIX TRANSF FRANCISCO JEFFERSON DA SILVA SOUZA 17 06");

        PessoaEntity parteOposta = new PessoaEntity();
        parteOposta.setId(501L);
        parteOposta.setNome("Francisco Jefferson Da Silva Souza");

        PessoaEntity titular = new PessoaEntity();
        titular.setId(728L);

        ClienteEntity cliente728 = new ClienteEntity();
        cliente728.setId(99L);
        cliente728.setCodigoCliente("00000728");
        cliente728.setPessoa(titular);

        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(1345L);
        processo.setPessoa(titular);
        processo.setCliente(cliente728);
        processo.setNumeroInterno(1345);

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("A")).thenReturn(Optional.of(contaA));
        when(processoRepository.findPessoaProcessoIdsPorNomeContidoNaDescricao(any()))
                .thenReturn(List.<Object[]>of(new Object[] {501L, 1345L}));
        when(pessoaRepository.findById(501L)).thenReturn(Optional.of(parteOposta));
        when(processoRepository.findById(1345L)).thenReturn(Optional.of(processo));
        when(processoApplicationService.resolverTextosPartesVinculoEmLote(Set.of(1345L)))
                .thenReturn(
                        Map.of(
                                1345L,
                                new ProcessoPartesVinculoTexto(
                                        "SE77E TELECOM EIRELI ME", "Francisco Jefferson Da Silva Souza")));
        when(lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(any(), any(), any(), any())).thenReturn(List.of());
        when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(any(), any(), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).anyMatch(s ->
                s.getOrigem() == OrigemSugestao.PESSOA_PROCESSO
                        && "A".equals(s.getContaCodigo())
                        && s.getProcessoId().equals(1345L)
                        && s.getClienteId().equals(99L)
                        && s.getPagadorPessoaId().equals(501L)
                        && s.getDescricaoRegra().contains("nome na descrição"));
    }

    @Test
    void sugerir_transfPixItamarCora_sugereContaENaoCliente() {
        lancamento.setDescricao(
                "Transf Pix recebida - ITAMAR ALEXANDRE F V R JUNIOR - 007.332.351-90");
        lancamento.setNatureza(NaturezaLancamento.CREDITO);
        lancamento.setNumeroBanco(29);

        PessoaEntity itamar = new PessoaEntity();
        itamar.setId(1L);
        itamar.setNome("Itamar Alexandre F V R Junior");
        itamar.setCpf("00733235190");

        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(50L);
        processo.setPessoa(itamar);
        processo.setNumeroInterno(1);

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("E")).thenReturn(Optional.of(contaE));
        when(pessoaRepository.findByCpf("00733235190")).thenReturn(Optional.of(itamar));
        when(processoRepository.findAllDistinctVinculadosPessoa(1L)).thenReturn(List.of(processo));
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(any(), any(), any(), any())).thenReturn(List.of());
        when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(any(), any(), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).isNotEmpty();
        assertThat(sugestoes.get(0).getContaCodigo()).isEqualTo("E");
        assertThat(sugestoes.get(0).getOrigem()).isEqualTo(OrigemSugestao.REGRA);
        assertThat(sugestoes).noneMatch(s -> "A".equals(s.getContaCodigo()));
    }

    @Test
    void sugerir_financImobiliario_sugereContaI() {
        lancamento.setDescricao("FINANC IMOBILIARIO 022 420");
        lancamento.setNatureza(NaturezaLancamento.DEBITO);
        lancamento.setValor(new BigDecimal("6815.13"));

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("I")).thenReturn(Optional.of(contaI));
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(any(), any(), any(), any())).thenReturn(List.of());
        when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(any(), any(), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).isNotEmpty();
        assertThat(sugestoes.get(0).getContaCodigo()).isEqualTo("I");
        assertThat(sugestoes.get(0).getConfianca()).isEqualTo(ConfiancaSugestao.ALTA);
        assertThat(sugestoes.get(0).getOrigem()).isEqualTo(OrigemSugestao.REGRA);
    }

    @Test
    void sugerir_historicoUsaDescricaoNorm_variacaoDataColada() {
        lancamento.setDescricao("PIX TRANSF BANCO I09/06");
        String norm = DescricaoNormalizer.normalizar("PIX TRANSF BANCO I10/06");

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(
                        eq(1), eq(norm), eq(lancamento.getDataLancamento()), eq(99L)))
                .thenReturn(List.<Object[]>of(new Object[] {6L, 4L}));
        when(contaContabilRepository.findById(6L)).thenReturn(Optional.of(contaE));
        when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(eq(1), eq(norm), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).anyMatch(s ->
                s.getOrigem() == OrigemSugestao.HISTORICO && s.getContaCodigo().equals("E"));
    }

    @Test
    void sugerir_recorrenciaUsaDescricaoNorm_mesmaChaveComDatasDiferentes() {
        lancamento.setDescricao("PIX TRANSF BANCO I09/06");
        String norm = DescricaoNormalizer.normalizar(lancamento.getDescricao());

        LancamentoFinanceiroEntity anterior = new LancamentoFinanceiroEntity();
        anterior.setContaContabil(contaE);
        anterior.setDataLancamento(LocalDate.of(2026, 5, 10));

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(eq(1), eq(norm), eq(lancamento.getDataLancamento()), eq(99L)))
                .thenReturn(List.of());
        when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(
                        eq(1), eq(norm), any(), any(), anyInt(), eq(lancamento.getDataLancamento()), eq(99L)))
                .thenReturn(List.of(anterior));
        when(contaContabilRepository.findById(6L)).thenReturn(Optional.of(contaE));

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).anyMatch(s ->
                s.getOrigem() == OrigemSugestao.RECORRENCIA && s.getContaCodigo().equals("E"));
    }

    @Test
    void sugerir_descricaoSemData_continuaCasandoHistorico() {
        lancamento.setDescricao("PAGTO CARTAO PERSONNALITE");
        lancamento.setDataLancamento(null);
        String norm = DescricaoNormalizer.normalizar(lancamento.getDescricao());

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(lancamentoRepository.contarContaPorDescricaoHistorico(1, norm))
                .thenReturn(List.<Object[]>of(new Object[] {6L, 3L}));
        when(contaContabilRepository.findById(6L)).thenReturn(Optional.of(contaE));
        when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(any(), any(), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).anyMatch(s -> s.getOrigem() == OrigemSugestao.HISTORICO);
    }

    @Test
    void sugerir_historicoPosterior_quandoAnteriorVazio() {
        String norm = DescricaoNormalizer.normalizar(lancamento.getDescricao());

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(
                        eq(1), eq(norm), eq(lancamento.getDataLancamento()), eq(99L)))
                .thenReturn(List.of());
        when(lancamentoRepository.contarContaPorDescricaoHistoricoPosterior(
                        eq(1), eq(norm), eq(lancamento.getDataLancamento()), eq(99L)))
                .thenReturn(List.<Object[]>of(new Object[] {6L, 2L}));
        when(contaContabilRepository.findById(6L)).thenReturn(Optional.of(contaE));
        when(lancamentoRepository.findRecorrenciaCandidatosAnteriores(any(), any(), any(), any(), anyInt(), any(), any()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).anyMatch(s ->
                s.getOrigem() == OrigemSugestao.HISTORICO_POSTERIOR && s.getContaCodigo().equals("E"));
    }

    @Test
    void aplicarSugestaoConvergeParaReconciliacao() {
        br.com.vilareal.financeiro.api.dto.AplicarSugestaoRequest req =
                new br.com.vilareal.financeiro.api.dto.AplicarSugestaoRequest();
        req.setLancamentoId(99L);
        req.setContaContabilId(7L); // A
        req.setProcessoId(16042L);

        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(16042L);
        lancamento.setNatureza(NaturezaLancamento.CREDITO);
        lancamento.setValor(new BigDecimal("1700.00"));
        when(lancamentoRepository.findById(99L)).thenReturn(Optional.of(lancamento));
        when(contaContabilRepository.findById(7L)).thenReturn(Optional.of(contaA));
        when(processoRepository.findById(16042L)).thenReturn(Optional.of(processo));
        when(clienteResolverService.resolverVinculoOpcional(any(), eq(processo)))
                .thenReturn(new ClienteResolverService.VinculoClientePessoa(null, null));
        when(lancamentoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.aplicarSugestao(req);

        // O "Aprovar" delega ao mesmo motor da reconciliação com o lançamento já persistido.
        org.mockito.Mockito.verify(locacaoReconciliacaoService).registrarAluguelClassificado(lancamento);
    }
}
