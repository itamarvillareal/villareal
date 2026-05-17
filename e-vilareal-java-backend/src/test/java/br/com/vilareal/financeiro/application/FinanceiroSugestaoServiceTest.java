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
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
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

    @InjectMocks
    private FinanceiroSugestaoService service;

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

        lancamento = new LancamentoFinanceiroEntity();
        lancamento.setId(99L);
        lancamento.setContaContabil(contaN);
        lancamento.setEtapa(EtapaLancamento.IMPORTADO);
        lancamento.setNumeroBanco(1);
        lancamento.setDescricao("PAGTO CARTAO PERSONNALITE");
        lancamento.setValor(new BigDecimal("1500.00"));
        lancamento.setNatureza(NaturezaLancamento.DEBITO);
        lancamento.setDataLancamento(LocalDate.of(2026, 3, 15));
        lancamento.setNumeroLancamento("PL-test");
    }

    @Test
    void sugerir_camadaRegra_contemPersonnalite() {
        RegraClassificacaoEntity regra = new RegraClassificacaoEntity();
        regra.setId(1L);
        regra.setPadraoDescricao("PERSONNALITE");
        regra.setTipoMatch(TipoMatch.CONTAINS);
        regra.setContaContabil(contaE);
        regra.setPrioridade(10);
        regra.setAtivo(true);

        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of(regra));
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
    void sugerir_camadaHistorico_mediaQuandoTresOuMais() {
        when(regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()).thenReturn(List.of());
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
}
