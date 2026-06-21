package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.domain.StatusLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.CompensacaoParDescarteRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.SaldoInicialBancoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.SemelhanteEscritorioDescarteRepository;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinanceiroApplicationServiceStatusLancamentoTest {

    @Mock
    private ContaContabilRepository contaContabilRepository;
    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private SaldoInicialBancoRepository saldoInicialRepository;
    @Mock
    private SemelhanteEscritorioDescarteRepository semelhanteEscritorioDescarteRepository;
    @Mock
    private CompensacaoParDescarteRepository compensacaoParDescarteRepository;
    @Mock
    private PessoaRepository pessoaRepository;
    @Mock
    private ProcessoRepository processoRepository;
    @Mock
    private ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    @Mock
    private ClienteResolverService clienteResolverService;
    @Mock
    private ContaBancariaResolverService contaBancariaResolverService;
    @Mock
    private FinanceiroSaudeService financeiroSaudeService;

    @InjectMocks
    private FinanceiroApplicationService service;

    @Test
    void aposentarLancamentos_marcaAposentado_eIdempotente() {
        LancamentoFinanceiroEntity ativo = lancamento(1L, StatusLancamento.ATIVO);
        LancamentoFinanceiroEntity jaAposentado = lancamento(2L, StatusLancamento.APOSENTADO);
        when(lancamentoRepository.findAllByIdIn(any())).thenReturn(List.of(ativo, jaAposentado));

        int primeira = service.aposentarLancamentos(List.of(1L, 2L), "teste");
        int segunda = service.aposentarLancamentos(List.of(1L, 2L), "teste");

        assertThat(primeira).isEqualTo(1);
        assertThat(segunda).isZero();
        assertThat(ativo.getStatus()).isEqualTo(StatusLancamento.APOSENTADO);
        verify(lancamentoRepository).saveAll(any());
    }

    @Test
    void reativarLancamentos_restauraAtivo_eIdempotente() {
        LancamentoFinanceiroEntity aposentado = lancamento(10L, StatusLancamento.APOSENTADO);
        when(lancamentoRepository.findAllByIdIn(any())).thenReturn(List.of(aposentado));

        int primeira = service.reativarLancamentos(List.of(10L));
        int segunda = service.reativarLancamentos(List.of(10L));

        assertThat(primeira).isEqualTo(1);
        assertThat(segunda).isZero();
        assertThat(aposentado.getStatus()).isEqualTo(StatusLancamento.ATIVO);
    }

    @Test
    void aposentarLancamentos_listaVazia_naoPersiste() {
        assertThat(service.aposentarLancamentos(List.of(), "x")).isZero();
        verify(lancamentoRepository, never()).saveAll(any());
    }

    private static LancamentoFinanceiroEntity lancamento(Long id, String status) {
        LancamentoFinanceiroEntity e = new LancamentoFinanceiroEntity();
        e.setId(id);
        e.setStatus(status);
        e.setNumeroBanco(26);
        e.setNumeroLancamento("PL-test");
        ContaContabilEntity conta = new ContaContabilEntity();
        conta.setId(1L);
        e.setContaContabil(conta);
        return e;
    }
}
