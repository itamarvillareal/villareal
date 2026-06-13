package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.AplicarRecorrenciaRequest;
import br.com.vilareal.financeiro.api.dto.AplicarRecorrenciaResponse;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.DescricaoNormalizer;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.TipoMatch;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.RegraClassificacaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.FinanceiroAnaliseRecorrenciaRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.FinanceiroAnaliseRecorrenciaRepository.PadraoRecorrenciaRow;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.RegraClassificacaoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
    private RegraClassificacaoRepository regraRepository;
    @Mock
    private FinanceiroSugestaoService sugestaoService;

    @InjectMocks
    private FinanceiroAnaliseService service;

    private PadraoRecorrenciaRow padrao;

    @BeforeEach
    void setUp() {
        padrao = new PadraoRecorrenciaRow();
        padrao.descricaoNorm = "PIX TRANSF BANCO I";
        padrao.descricaoExemplo = "PIX TRANSF BANCO I09/06";
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

    @Test
    void listarRecorrencias_filtraPorConfiancaEOrdenaPorPendentes() {
        when(recorrenciaRepository.listarPadroesAgregados(null, null)).thenReturn(List.of(padrao));

        Page<?> page = service.listarRecorrencias(
                ConfiancaSugestao.ALTA, null, true, null, PageRequest.of(0, 50));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0)).extracting("qtdPendentes").isEqualTo(7L);
        assertThat(page.getContent().get(0)).extracting("confianca").isEqualTo(ConfiancaSugestao.ALTA);
    }

    @Test
    void aplicarRecorrencia_dryRunNaoPersiste() {
        LancamentoFinanceiroEntity p1 = new LancamentoFinanceiroEntity();
        p1.setId(1L);
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341)).thenReturn(List.of(p1));

        AplicarRecorrenciaRequest req = new AplicarRecorrenciaRequest();
        req.setDescricaoNorm("PIX TRANSF BANCO I");
        req.setNumeroBanco(341);
        req.setContaContabilId(7L);
        req.setDryRun(true);

        AplicarRecorrenciaResponse resp = service.aplicarRecorrencia(req);

        assertThat(resp.getAplicados()).isEqualTo(1);
        verify(sugestaoService, never()).aplicarSugestoesLote(any());
        verify(regraRepository, never()).save(any());
    }

    @Test
    void aplicarRecorrencia_criaRegraQuandoSolicitado() {
        LancamentoFinanceiroEntity p1 = new LancamentoFinanceiroEntity();
        p1.setId(1L);
        when(lancamentoRepository.findPendentesPorPadrao("PIX TRANSF BANCO I", 341)).thenReturn(List.of(p1));
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

        assertThat(resp.getAplicados()).isEqualTo(1);
        assertThat(resp.getRegraCriadaId()).isEqualTo(88L);
        assertThat(resp.isJaExistiaRegra()).isFalse();
        verify(sugestaoService).aplicarSugestoesLote(any());

        ArgumentCaptor<RegraClassificacaoEntity> cap = ArgumentCaptor.forClass(RegraClassificacaoEntity.class);
        verify(regraRepository).save(cap.capture());
        assertThat(cap.getValue().getPadraoDescricao()).isEqualTo("PIX TRANSF BANCO I");
        assertThat(cap.getValue().getTipoMatch()).isEqualTo(TipoMatch.CONTAINS);
        assertThat(cap.getValue().getPrioridade()).isEqualTo(20);
    }
}
