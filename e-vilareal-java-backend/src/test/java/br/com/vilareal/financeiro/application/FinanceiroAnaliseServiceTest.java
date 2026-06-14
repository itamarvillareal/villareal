package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.AplicarRecorrenciaRequest;
import br.com.vilareal.financeiro.api.dto.AplicarRecorrenciaResponse;
import br.com.vilareal.financeiro.api.dto.DescartarRecorrenciaRequest;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.EscopoAplicarRecorrencia;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.PrecisaoValorRecorrencia;
import br.com.vilareal.financeiro.domain.TipoMatch;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.RecorrenciaPadraoDescarteEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.RegraClassificacaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.FinanceiroAnaliseRecorrenciaRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.FinanceiroAnaliseRecorrenciaRepository.PadraoRecorrenciaRow;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.FinanceiroAnaliseRecorrenciaRepository.VinculoDominanteRow;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.RegraClassificacaoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.RecorrenciaPadraoDescarteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.api.dto.ProcessoPartesVinculoTexto;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinanceiroAnaliseServiceTest {

    @Mock
    private FinanceiroAnaliseRecorrenciaRepository recorrenciaRepository;
    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private ContaContabilRepository contaContabilRepository;
    @Mock
    private ClienteRepository clienteRepository;
    @Mock
    private ProcessoRepository processoRepository;
    @Mock
    private ProcessoApplicationService processoApplicationService;
    @Mock
    private RegraClassificacaoRepository regraRepository;
    @Mock
    private RecorrenciaPadraoDescarteRepository descarteRepository;
    @Mock
    private FinanceiroSugestaoService sugestaoService;

    @InjectMocks
    private FinanceiroAnaliseService service;

    private PadraoRecorrenciaRow padrao;

    @BeforeEach
    void setUp() {
        lenient().when(descarteRepository.findAll()).thenReturn(List.of());
        lenient().when(descarteRepository.findByNumeroBanco(any())).thenReturn(List.of());
        padrao = new PadraoRecorrenciaRow();
        padrao.descricaoNorm = "PIX TRANSF BANCO I";
        padrao.descricaoExemplo = "PIX TRANSF BANCO I09/06";
        padrao.dataExemplo = LocalDate.of(2025, 6, 9);
        padrao.numeroBanco = 341;
        padrao.bancoNome = "Itaú";
        padrao.ocorrenciasHistorico = 10;
        padrao.mesesCobertos = 10;
        padrao.valorMedio = new BigDecimal("1150.00");
        padrao.contaContabilId = 1L;
        padrao.cntContaDominante = 10;
        padrao.qtdPendentes = 7;
        padrao.contaCodigo = "F";
        padrao.contaNome = "Conta Fundos Investimentos";
    }

    private void stubHistoricoModal100() {
        List<BigDecimal> historico = IntStream.range(0, 10)
                .mapToObj(i -> new BigDecimal("100.00"))
                .toList();
        when(lancamentoRepository.listarValoresHistoricoPorPadrao(any(), any())).thenReturn(historico);
    }

    @Test
    void listarRecorrencias_filtraPorConfiancaEOrdenaPorPendentes() {
        stubHistoricoModal100();
        LancamentoFinanceiroEntity p = new LancamentoFinanceiroEntity();
        p.setValor(new BigDecimal("100.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341)).thenReturn(List.of(p, p, p, p, p, p, p));
        when(recorrenciaRepository.listarPadroesAgregados(null, null)).thenReturn(List.of(padrao));

        Page<?> page = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.EXATO, false, PageRequest.of(0, 50));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0)).extracting("qtdPendentesExato").isEqualTo(7L);
        assertThat(page.getContent().get(0)).extracting("confianca").isEqualTo(ConfiancaSugestao.ALTA);
    }

    @Test
    void listarRecorrencias_expoeDataExemploDoPadrao() {
        stubHistoricoModal100();
        when(recorrenciaRepository.listarPadroesAgregados(null, null)).thenReturn(List.of(padrao));
        LancamentoFinanceiroEntity p = new LancamentoFinanceiroEntity();
        p.setValor(new BigDecimal("100.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341)).thenReturn(List.of(p));

        Page<?> page = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.EXATO, false, PageRequest.of(0, 50));

        assertThat(page.getContent().get(0))
                .extracting("descricaoExemplo", "dataExemplo")
                .containsExactly("PIX TRANSF BANCO I09/06", LocalDate.of(2025, 6, 9));
    }

    @Test
    void aplicarRecorrencia_dryRunExpoeDataLancamentoDosCandidatos() {
        stubHistoricoModal100();
        LancamentoFinanceiroEntity p1 = new LancamentoFinanceiroEntity();
        p1.setValor(new BigDecimal("100.00"));
        p1.setDataLancamento(LocalDate.of(2025, 12, 21));
        p1.setDescricao("PIX TRANSF AVELAR 21/12");
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341)).thenReturn(List.of(p1));

        AplicarRecorrenciaRequest req = new AplicarRecorrenciaRequest();
        req.setDescricaoNorm("PIX TRANSF BANCO I");
        req.setNumeroBanco(341);
        req.setContaContabilId(1L);
        req.setDryRun(true);

        AplicarRecorrenciaResponse resp = service.aplicarRecorrencia(req);
        assertThat(resp.getLancamentos()).hasSize(1);
        assertThat(resp.getLancamentos().get(0))
                .extracting("dataLancamento", "descricao", "acao")
                .containsExactly(LocalDate.of(2025, 12, 21), "PIX TRANSF AVELAR 21/12", "NOVO");
    }

    @Test
    void listarRecorrencias_precisaoExatoNaoContaAproximados() {
        stubHistoricoModal100();
        padrao.qtdPendentes = 2;
        when(recorrenciaRepository.listarPadroesAgregados(null, null)).thenReturn(List.of(padrao));

        LancamentoFinanceiroEntity exato = new LancamentoFinanceiroEntity();
        exato.setValor(new BigDecimal("100.00"));
        LancamentoFinanceiroEntity aprox = new LancamentoFinanceiroEntity();
        aprox.setValor(new BigDecimal("103.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341))
                .thenReturn(List.of(exato, aprox));

        Page<?> exatoPage = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.EXATO, false, PageRequest.of(0, 50));
        assertThat(exatoPage.getTotalElements()).isEqualTo(1);
        assertThat(exatoPage.getContent().get(0)).extracting("qtdPendentesExato", "qtdPendentesAprox", "qtdPendentes")
                .containsExactly(1L, 1L, 1L);

        Page<?> todosPage = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.TODOS, false, PageRequest.of(0, 50));
        assertThat(todosPage.getContent().get(0)).extracting("qtdPendentes").isEqualTo(2L);
    }

    @Test
    void listarRecorrencias_bancoIApareceComParciaisSemNovos() {
        padrao.numeroBanco = 1;
        padrao.contaCodigo = "A";
        padrao.contaNome = "Conta Escritório";
        padrao.qtdPendentes = 0;
        padrao.ocorrenciasHistorico = 50;
        padrao.cntContaDominante = 50;

        VinculoDominanteRow vinculo = new VinculoDominanteRow();
        vinculo.clienteId = 938L;
        vinculo.processoId = 16025L;
        vinculo.cnt = 47;

        stubHistoricoModal100();
        when(recorrenciaRepository.listarPadroesAgregados(null, null)).thenReturn(List.of(padrao));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 1)).thenReturn(List.of());
        LancamentoFinanceiroEntity parcial = new LancamentoFinanceiroEntity();
        parcial.setValor(new BigDecimal("100.00"));
        when(lancamentoRepository.findParciaisParaCompletarPorPadrao("PIX TRANSF BANCO I", 1, 1L))
                .thenReturn(List.of(parcial, parcial, parcial));
        when(recorrenciaRepository.buscarVinculoDominanteContaA("PIX TRANSF BANCO I", 1, 1L))
                .thenReturn(vinculo);
        when(recorrenciaRepository.contarComVinculoCompletoContaA("PIX TRANSF BANCO I", 1, 1L))
                .thenReturn(47L);

        Page<?> page = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.EXATO, false, PageRequest.of(0, 50));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0))
                .extracting("qtdCompletarExato", "qtdParaCompletar", "valorFixo", "clienteId")
                .containsExactly(3L, 3L, true, 938L);
    }

    @Test
    void listarRecorrencias_apenasAcionaveisExatoExcluiSomenteDivergentes() {
        stubHistoricoModal100();
        padrao.qtdPendentes = 3;
        when(recorrenciaRepository.listarPadroesAgregados(null, null)).thenReturn(List.of(padrao));

        LancamentoFinanceiroEntity divergente = new LancamentoFinanceiroEntity();
        divergente.setValor(new BigDecimal("50.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341))
                .thenReturn(List.of(divergente, divergente, divergente));

        Page<?> page = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.EXATO, false, PageRequest.of(0, 50));

        assertThat(page.getTotalElements()).isZero();
    }

    @Test
    void listarRecorrencias_qtdAcionaveisAlinhadaComPrecisao() {
        stubHistoricoModal100();
        when(recorrenciaRepository.listarPadroesAgregados(null, null)).thenReturn(List.of(padrao));

        LancamentoFinanceiroEntity exato = new LancamentoFinanceiroEntity();
        exato.setValor(new BigDecimal("100.00"));
        LancamentoFinanceiroEntity aprox = new LancamentoFinanceiroEntity();
        aprox.setValor(new BigDecimal("103.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341))
                .thenReturn(List.of(exato, aprox));

        Page<?> exatoPage = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.EXATO, false, PageRequest.of(0, 50));
        assertThat(exatoPage.getContent().get(0)).extracting("qtdAcionaveis", "qtdPendentesExato")
                .containsExactly(1L, 1L);

        Page<?> todosPage = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.TODOS, false, PageRequest.of(0, 50));
        assertThat(todosPage.getContent().get(0)).extracting("qtdAcionaveis").isEqualTo(2L);
    }

    @Test
    void listarRecorrencias_exatoExcluiPadraoSemValorFixo() {
        List<BigDecimal> historicoVariavel = List.of(
                new BigDecimal("90.00"),
                new BigDecimal("95.00"),
                new BigDecimal("100.00"),
                new BigDecimal("105.00"),
                new BigDecimal("95.00"),
                new BigDecimal("100.00"),
                new BigDecimal("95.00"));
        when(lancamentoRepository.listarValoresHistoricoPorPadrao(any(), any())).thenReturn(historicoVariavel);
        when(recorrenciaRepository.listarPadroesAgregados(null, null)).thenReturn(List.of(padrao));

        LancamentoFinanceiroEntity exato = new LancamentoFinanceiroEntity();
        exato.setValor(new BigDecimal("95.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341)).thenReturn(List.of(exato));

        Page<?> exatoPage = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.EXATO, false, PageRequest.of(0, 50));
        assertThat(exatoPage.getTotalElements()).isZero();

        Page<?> todosPage = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.TODOS, false, PageRequest.of(0, 50));
        assertThat(todosPage.getTotalElements()).isEqualTo(1);
    }

    @Test
    void aplicarRecorrencia_dryRunNaoPersiste() {
        stubHistoricoModal100();
        LancamentoFinanceiroEntity p1 = new LancamentoFinanceiroEntity();
        p1.setId(1L);
        p1.setValor(new BigDecimal("100.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341)).thenReturn(List.of(p1));
        when(lancamentoRepository.findParciaisParaCompletarPorPadrao("PIX TRANSF BANCO I", 341, 7L))
                .thenReturn(List.of());

        AplicarRecorrenciaRequest req = new AplicarRecorrenciaRequest();
        req.setDescricaoNorm("PIX TRANSF BANCO I");
        req.setNumeroBanco(341);
        req.setContaContabilId(7L);
        req.setDryRun(true);

        AplicarRecorrenciaResponse resp = service.aplicarRecorrencia(req);

        assertThat(resp.getAplicadosNovos()).isEqualTo(1);
        assertThat(resp.getAplicadosCompletados()).isZero();
        verify(sugestaoService, never()).aplicarSugestoesLote(any());
    }

    @Test
    void aplicarRecorrencia_defaultExatoIgnoraAproximados() {
        stubHistoricoModal100();
        LancamentoFinanceiroEntity exato = new LancamentoFinanceiroEntity();
        exato.setId(1L);
        exato.setValor(new BigDecimal("100.00"));
        LancamentoFinanceiroEntity aprox = new LancamentoFinanceiroEntity();
        aprox.setId(2L);
        aprox.setValor(new BigDecimal("103.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341))
                .thenReturn(List.of(exato, aprox));
        when(lancamentoRepository.findParciaisParaCompletarPorPadrao("PIX TRANSF BANCO I", 341, 7L))
                .thenReturn(List.of());
        when(sugestaoService.aplicarSugestoesLote(any()))
                .thenReturn(new br.com.vilareal.financeiro.api.dto.AplicarSugestaoLoteResult());

        AplicarRecorrenciaRequest req = new AplicarRecorrenciaRequest();
        req.setDescricaoNorm("PIX TRANSF BANCO I");
        req.setNumeroBanco(341);
        req.setContaContabilId(7L);
        req.setPrecisaoValor(PrecisaoValorRecorrencia.EXATO);

        AplicarRecorrenciaResponse resp = service.aplicarRecorrencia(req);

        assertThat(resp.getAplicadosNovos()).isEqualTo(1);
        verify(sugestaoService).aplicarSugestoesLote(any());
    }

    @Test
    void aplicarRecorrencia_completarParciaisViraVinculado() {
        stubHistoricoModal100();
        LancamentoFinanceiroEntity parcial = new LancamentoFinanceiroEntity();
        parcial.setId(99L);
        parcial.setEtapa(EtapaLancamento.CLASSIFICADO);
        parcial.setValor(new BigDecimal("100.00"));
        when(lancamentoRepository.findParciaisParaCompletarPorPadrao("PIX TRANSF BANCO I", 1, 1L))
                .thenReturn(List.of(parcial));
        when(sugestaoService.aplicarSugestoesLote(any()))
                .thenReturn(new br.com.vilareal.financeiro.api.dto.AplicarSugestaoLoteResult());

        AplicarRecorrenciaRequest req = new AplicarRecorrenciaRequest();
        req.setDescricaoNorm("PIX TRANSF BANCO I");
        req.setNumeroBanco(1);
        req.setContaContabilId(1L);
        req.setClienteId(938L);
        req.setProcessoId(16025L);
        req.setEscopo(EscopoAplicarRecorrencia.COMPLETAR);

        AplicarRecorrenciaResponse resp = service.aplicarRecorrencia(req);

        assertThat(resp.getAplicadosCompletados()).isEqualTo(1);
        verify(lancamentoRepository).findParciaisParaCompletarPorPadrao("PIX TRANSF BANCO I", 1, 1L);
    }

    @Test
    void aplicarRecorrencia_criaRegraQuandoSolicitado() {
        stubHistoricoModal100();
        LancamentoFinanceiroEntity p1 = new LancamentoFinanceiroEntity();
        p1.setId(1L);
        p1.setValor(new BigDecimal("100.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341)).thenReturn(List.of(p1));
        when(lancamentoRepository.findParciaisParaCompletarPorPadrao("PIX TRANSF BANCO I", 341, 7L))
                .thenReturn(List.of());
        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());

        ContaContabilEntity contaF = new ContaContabilEntity();
        contaF.setId(7L);
        contaF.setCodigo("F");
        when(contaContabilRepository.findById(7L)).thenReturn(Optional.of(contaF));

        RegraClassificacaoEntity salva = new RegraClassificacaoEntity();
        salva.setId(88L);
        when(regraRepository.save(any())).thenReturn(salva);
        when(sugestaoService.aplicarSugestoesLote(any())).thenReturn(new br.com.vilareal.financeiro.api.dto.AplicarSugestaoLoteResult());

        AplicarRecorrenciaRequest req = new AplicarRecorrenciaRequest();
        req.setDescricaoNorm("PIX TRANSF BANCO I");
        req.setNumeroBanco(341);
        req.setContaContabilId(7L);
        req.setCriarRegra(true);

        AplicarRecorrenciaResponse resp = service.aplicarRecorrencia(req);

        assertThat(resp.getAplicadosNovos()).isEqualTo(1);
        assertThat(resp.getRegraCriadaId()).isEqualTo(88L);

        ArgumentCaptor<RegraClassificacaoEntity> cap = ArgumentCaptor.forClass(RegraClassificacaoEntity.class);
        verify(regraRepository).save(cap.capture());
        assertThat(cap.getValue().getTipoMatch()).isEqualTo(TipoMatch.CONTAINS);
    }

    @Test
    void listarRecorrencias_douguimarDivergenteAcionavelEmIgnorarValor() {
        padrao.descricaoNorm = "PIX TRANSF DOUGUIM";
        padrao.descricaoExemplo = "PIX TRANSF DOUGUIM02 06";
        padrao.numeroBanco = 1;
        padrao.contaCodigo = "A";
        padrao.contaNome = "Conta Escritório";
        padrao.contaContabilId = 1L;
        padrao.qtdPendentes = 1;
        padrao.ocorrenciasHistorico = 12;
        padrao.cntContaDominante = 12;

        List<BigDecimal> historico = IntStream.range(0, 12)
                .mapToObj(i -> new BigDecimal("850.00"))
                .toList();
        when(lancamentoRepository.listarValoresHistoricoPorPadrao(any(), any())).thenReturn(historico);

        VinculoDominanteRow vinculo = new VinculoDominanteRow();
        vinculo.clienteId = 42L;
        vinculo.processoId = 99L;
        vinculo.cnt = 12;

        LancamentoFinanceiroEntity divergente = new LancamentoFinanceiroEntity();
        divergente.setValor(new BigDecimal("1200.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF DOUGUIM", 1))
                .thenReturn(List.of(divergente));
        when(lancamentoRepository.findParciaisParaCompletarPorPadrao("PIX TRANSF DOUGUIM", 1, 1L))
                .thenReturn(List.of());
        when(recorrenciaRepository.listarPadroesAgregados(null, null)).thenReturn(List.of(padrao));
        when(recorrenciaRepository.buscarVinculoDominanteContaA("PIX TRANSF DOUGUIM", 1, 1L))
                .thenReturn(vinculo);
        when(recorrenciaRepository.contarComVinculoCompletoContaA("PIX TRANSF DOUGUIM", 1, 1L))
                .thenReturn(12L);
        when(processoApplicationService.resolverTextosPartesVinculoEmLote(Set.of(99L)))
                .thenReturn(Map.of(99L, new ProcessoPartesVinculoTexto("DOUGUIMAR LTDA", "BRUNO FERREIRA")));

        Page<?> exatoPage = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.EXATO, false, PageRequest.of(0, 50));
        assertThat(exatoPage.getTotalElements()).isZero();

        Page<?> todosPage = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.TODOS, false, PageRequest.of(0, 50));
        assertThat(todosPage.getTotalElements()).isZero();

        Page<?> ignorarPage = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.IGNORAR_VALOR, false, PageRequest.of(0, 50));
        assertThat(ignorarPage.getTotalElements()).isEqualTo(1);
        assertThat(ignorarPage.getContent().get(0))
                .extracting("qtdAcionaveis", "qtdDivergentes", "qtdPendentes", "clienteId", "processoId", "contaCodigo", "parteOposta")
                .containsExactly(1L, 1L, 1L, 42L, 99L, "A", "BRUNO FERREIRA");
    }

    @Test
    void listarRecorrencias_qtdDivergentesContaSomenteDivergentes() {
        stubHistoricoModal100();
        padrao.qtdPendentes = 2;
        when(recorrenciaRepository.listarPadroesAgregados(null, null)).thenReturn(List.of(padrao));

        LancamentoFinanceiroEntity exato = new LancamentoFinanceiroEntity();
        exato.setValor(new BigDecimal("100.00"));
        LancamentoFinanceiroEntity divergente = new LancamentoFinanceiroEntity();
        divergente.setValor(new BigDecimal("50.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341))
                .thenReturn(List.of(exato, divergente));

        Page<?> page = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, false, null, PrecisaoValorRecorrencia.EXATO, false, PageRequest.of(0, 50));
        assertThat(page.getContent().get(0)).extracting("qtdDivergentes", "qtdPendentesExato").containsExactly(1L, 1L);
    }

    @Test
    void aplicarRecorrencia_ignorarValorIncluiDivergentes() {
        List<BigDecimal> historico = IntStream.range(0, 10)
                .mapToObj(i -> new BigDecimal("850.00"))
                .toList();
        when(lancamentoRepository.listarValoresHistoricoPorPadrao(any(), any())).thenReturn(historico);

        LancamentoFinanceiroEntity divergente = new LancamentoFinanceiroEntity();
        divergente.setId(5L);
        divergente.setValor(new BigDecimal("1200.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF DOUGUIM", 1)).thenReturn(List.of(divergente));
        when(lancamentoRepository.findParciaisParaCompletarPorPadrao("PIX TRANSF DOUGUIM", 1, 1L))
                .thenReturn(List.of());
        when(sugestaoService.aplicarSugestoesLote(any()))
                .thenReturn(new br.com.vilareal.financeiro.api.dto.AplicarSugestaoLoteResult());

        AplicarRecorrenciaRequest req = new AplicarRecorrenciaRequest();
        req.setDescricaoNorm("PIX TRANSF DOUGUIM");
        req.setNumeroBanco(1);
        req.setContaContabilId(1L);
        req.setPrecisaoValor(PrecisaoValorRecorrencia.IGNORAR_VALOR);

        AplicarRecorrenciaResponse resp = service.aplicarRecorrencia(req);
        assertThat(resp.getAplicadosNovos()).isEqualTo(1);
    }

    @Test
    void aplicarRecorrencia_exatoNaoIncluiDivergentesMesmoComExatoNoLote() {
        stubHistoricoModal100();
        LancamentoFinanceiroEntity exato = new LancamentoFinanceiroEntity();
        exato.setId(1L);
        exato.setValor(new BigDecimal("100.00"));
        LancamentoFinanceiroEntity divergente = new LancamentoFinanceiroEntity();
        divergente.setId(2L);
        divergente.setValor(new BigDecimal("50.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341))
                .thenReturn(List.of(exato, divergente));
        when(lancamentoRepository.findParciaisParaCompletarPorPadrao("PIX TRANSF BANCO I", 341, 7L))
                .thenReturn(List.of());
        when(sugestaoService.aplicarSugestoesLote(any()))
                .thenReturn(new br.com.vilareal.financeiro.api.dto.AplicarSugestaoLoteResult());

        AplicarRecorrenciaRequest req = new AplicarRecorrenciaRequest();
        req.setDescricaoNorm("PIX TRANSF BANCO I");
        req.setNumeroBanco(341);
        req.setContaContabilId(7L);
        req.setPrecisaoValor(PrecisaoValorRecorrencia.EXATO);

        AplicarRecorrenciaResponse resp = service.aplicarRecorrencia(req);
        assertThat(resp.getAplicadosNovos()).isEqualTo(1);
    }

    @Test
    void descartarRecorrencia_salvaDescarteCompleto() {
        DescartarRecorrenciaRequest req = new DescartarRecorrenciaRequest();
        req.setDescricaoNorm("PIX TRANSF BANCO I");
        req.setNumeroBanco(341);

        service.descartarRecorrencia(req);

        ArgumentCaptor<RecorrenciaPadraoDescarteEntity> captor =
                ArgumentCaptor.forClass(RecorrenciaPadraoDescarteEntity.class);
        verify(descarteRepository).save(captor.capture());
        assertThat(captor.getValue())
                .extracting("descricaoNorm", "numeroBanco", "somenteVinculo", "clienteId", "processoId")
                .containsExactly("PIX TRANSF BANCO I", 341, false, 0L, 0L);
    }

    @Test
    void listarRecorrencias_excluiPadraoDescartado() {
        when(recorrenciaRepository.listarPadroesAgregados(null, null)).thenReturn(List.of(padrao));

        RecorrenciaPadraoDescarteEntity descarte = new RecorrenciaPadraoDescarteEntity();
        descarte.setDescricaoNorm("PIX TRANSF BANCO I");
        descarte.setNumeroBanco(341);
        descarte.setSomenteVinculo(false);
        when(descarteRepository.findAll()).thenReturn(List.of(descarte));

        Page<?> page = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, false, null, PrecisaoValorRecorrencia.EXATO, false, PageRequest.of(0, 50));

        assertThat(page.getTotalElements()).isZero();
    }

    @Test
    void listarRecorrencias_descarteVinculoMantemPadraoSemVinculo() {
        padrao.numeroBanco = 1;
        padrao.contaCodigo = "A";
        padrao.qtdPendentes = 0;

        VinculoDominanteRow vinculo = new VinculoDominanteRow();
        vinculo.clienteId = 938L;
        vinculo.processoId = 16025L;
        vinculo.cnt = 47;

        stubHistoricoModal100();
        when(recorrenciaRepository.listarPadroesAgregados(null, null)).thenReturn(List.of(padrao));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 1)).thenReturn(List.of());
        LancamentoFinanceiroEntity parcial = new LancamentoFinanceiroEntity();
        parcial.setValor(new BigDecimal("100.00"));
        when(lancamentoRepository.findParciaisParaCompletarPorPadrao("PIX TRANSF BANCO I", 1, 1L))
                .thenReturn(List.of(parcial));
        when(recorrenciaRepository.buscarVinculoDominanteContaA("PIX TRANSF BANCO I", 1, 1L))
                .thenReturn(vinculo);
        when(recorrenciaRepository.contarComVinculoCompletoContaA("PIX TRANSF BANCO I", 1, 1L))
                .thenReturn(47L);

        RecorrenciaPadraoDescarteEntity descarteVinculo = new RecorrenciaPadraoDescarteEntity();
        descarteVinculo.setDescricaoNorm("PIX TRANSF BANCO I");
        descarteVinculo.setNumeroBanco(1);
        descarteVinculo.setSomenteVinculo(true);
        descarteVinculo.setClienteId(938L);
        descarteVinculo.setProcessoId(16025L);
        when(descarteRepository.findAll()).thenReturn(List.of(descarteVinculo));

        Page<?> page = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.EXATO, false, PageRequest.of(0, 50));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0))
                .extracting("clienteId", "processoId", "qtdCompletarExato")
                .containsExactly(null, null, 1L);
    }

    @Test
    void listarRecorrencias_somenteConfiancaPerfeitaExigeAltaComConsistenciaTotal() {
        stubHistoricoModal100();
        when(recorrenciaRepository.listarPadroesAgregados(null, null)).thenReturn(List.of(padrao));
        LancamentoFinanceiroEntity pendente = new LancamentoFinanceiroEntity();
        pendente.setValor(new BigDecimal("100.00"));
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341))
                .thenReturn(List.of(pendente));

        Page<?> perfeita = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.EXATO, true, PageRequest.of(0, 50));
        assertThat(perfeita.getTotalElements()).isEqualTo(1);
        assertThat(perfeita.getContent().get(0)).extracting("confianca", "consistenciaConta")
                .containsExactly(ConfiancaSugestao.ALTA, 1.0);

        padrao.cntContaDominante = 9;
        Page<?> imperfeita = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PrecisaoValorRecorrencia.EXATO, true, PageRequest.of(0, 50));
        assertThat(imperfeita.getTotalElements()).isZero();
    }
}
