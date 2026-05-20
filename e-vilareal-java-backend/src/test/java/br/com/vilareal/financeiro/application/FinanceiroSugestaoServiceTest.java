package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.SugestaoClassificacaoResponse;
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
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
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

    @InjectMocks
    private FinanceiroSugestaoService service;

    private ContaContabilEntity contaA;
    private ContaContabilEntity contaE;
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

        lancamento = new LancamentoFinanceiroEntity();
        lancamento.setId(99L);
        lancamento.setContaContabil(contaN);
        lancamento.setEtapa(EtapaLancamento.IMPORTADO);
        lancamento.setNumeroBanco(1);
        lenient()
                .when(clienteCodigoPessoaResolver.codigoClienteExibicaoParaPessoaId(anyLong()))
                .thenAnswer(inv -> String.format("COD-%d", inv.getArgument(0, Long.class)));

        lancamento.setDescricao("PAGTO CARTAO PERSONNALITE");
        lancamento.setValor(new BigDecimal("1500.00"));
        lancamento.setNatureza(NaturezaLancamento.DEBITO);
        lancamento.setDataLancamento(LocalDate.of(2026, 3, 15));
        lancamento.setNumeroLancamento("PL-test");
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
        when(lancamentoRepository.contarContaPorDescricaoHistorico(any(), any())).thenReturn(List.of());
        when(lancamentoRepository.findRecorrenciaCandidatos(any(), any(), any(), any(), anyInt()))
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
        when(lancamentoRepository.contarContaPorDescricaoHistorico(any(), any())).thenReturn(List.of());
        when(lancamentoRepository.findRecorrenciaCandidatos(any(), any(), any(), any(), anyInt()))
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
        when(lancamentoRepository.contarContaPorDescricaoHistorico(1, lancamento.getDescricao()))
                .thenReturn(List.<Object[]>of(new Object[] {5L, 10L}));
        when(contaContabilRepository.findById(5L)).thenReturn(Optional.of(contaN));
        when(lancamentoRepository.findRecorrenciaCandidatos(any(), any(), any(), any(), anyInt()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).isEmpty();
    }

    @Test
    void sugerir_camadaHistorico_mediaQuandoTresOuMais() {
        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(lancamentoRepository.contarContaPorDescricaoHistorico(1, lancamento.getDescricao()))
                .thenReturn(List.<Object[]>of(new Object[] {6L, 5L}));
        when(contaContabilRepository.findById(6L)).thenReturn(Optional.of(contaE));
        when(lancamentoRepository.findRecorrenciaCandidatos(any(), any(), any(), any(), anyInt()))
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

        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(50L);
        processo.setPessoa(titular);
        processo.setNumeroInterno(12);

        LancamentoFinanceiroEntity anterior = new LancamentoFinanceiroEntity();
        anterior.setId(10L);
        anterior.setContaContabil(contaA);
        anterior.setCliente(titular);
        anterior.setProcesso(processo);
        anterior.setDataLancamento(LocalDate.of(2026, 4, 10));

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(pessoaRepository.findByCpf("76467791134")).thenReturn(Optional.of(pagador));
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(
                        eq("76467791134"), eq(99L), eq(EtapaLancamento.IMPORTADO), any(Pageable.class)))
                .thenReturn(List.of(anterior));
        when(lancamentoRepository.contarContaPorDescricaoHistorico(any(), any())).thenReturn(List.of());
        when(lancamentoRepository.findRecorrenciaCandidatos(any(), any(), any(), any(), anyInt()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).isNotEmpty();
        SugestaoClassificacaoResponse primeira = sugestoes.get(0);
        assertThat(primeira.getOrigem()).isEqualTo(OrigemSugestao.DEPOSITO_IDENTIFICADO);
        assertThat(primeira.getContaCodigo()).isEqualTo("A");
        assertThat(primeira.getClienteId()).isEqualTo(728L);
        assertThat(primeira.getProcessoId()).isEqualTo(50L);
        assertThat(primeira.getRotuloVinculo()).isEqualTo("COD-728 · proc 12");
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

        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(50L);
        processo.setPessoa(titular);
        processo.setNumeroInterno(3);

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
        when(pessoaRepository.findByCpf("76467791134")).thenReturn(Optional.of(pagador));
        when(lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(any(), any(), any(), any()))
                .thenReturn(List.of());
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("A")).thenReturn(Optional.of(contaA));
        when(processoRepository.findAllDistinctVinculadosPessoa(900L)).thenReturn(List.of(processo));
        when(lancamentoRepository.contarContaPorDescricaoHistorico(any(), any())).thenReturn(List.of());
        when(lancamentoRepository.findRecorrenciaCandidatos(any(), any(), any(), any(), anyInt()))
                .thenReturn(List.of());

        List<SugestaoClassificacaoResponse> sugestoes = service.sugerir(lancamento);

        assertThat(sugestoes).anyMatch(s ->
                s.getOrigem() == OrigemSugestao.PESSOA_PROCESSO
                        && "A".equals(s.getContaCodigo())
                        && s.getProcessoId().equals(50L)
                        && "COD-728 · proc 3".equals(s.getRotuloVinculo()));
    }
}
