package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.LimparExtratoResult;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinanceiroApplicationServiceLimparExtratoTest {

    @Mock
    private ContaContabilRepository contaContabilRepository;
    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private PessoaRepository pessoaRepository;
    @Mock
    private ProcessoRepository processoRepository;

    @InjectMocks
    private FinanceiroApplicationService service;

    @Test
    void limparCefComNumeroBancoAgregaPorNomeEPorNumeroEDeletaTodos() {
        ContaContabilEntity contaN = new ContaContabilEntity();
        contaN.setId(99L);
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("N")).thenReturn(Optional.of(contaN));
        when(lancamentoRepository.findDistinctEloFinanceiroIdsByBancoNormalizado("CEF")).thenReturn(List.of());
        when(lancamentoRepository.findDistinctEloFinanceiroIdsByNumeroBanco(5)).thenReturn(List.of());

        LancamentoFinanceiroEntity porNome = new LancamentoFinanceiroEntity();
        porNome.setId(1L);
        porNome.setBancoNome("CEF");
        porNome.setNumeroBanco(5);

        LancamentoFinanceiroEntity soNumero = new LancamentoFinanceiroEntity();
        soNumero.setId(2L);
        soNumero.setBancoNome("rótulo diverso");
        soNumero.setNumeroBanco(5);

        when(lancamentoRepository.findAllByBancoNormalizado("CEF")).thenReturn(List.of(porNome));
        when(lancamentoRepository.findAllByNumeroBanco(5)).thenReturn(List.of(soNumero));

        LimparExtratoResult r = service.limparExtratoBancoEElosRelacionados("CEF", 5);

        assertThat(r.getLancamentosRemovidos()).isEqualTo(2);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<LancamentoFinanceiroEntity>> cap = ArgumentCaptor.forClass(Iterable.class);
        verify(lancamentoRepository).deleteAll(cap.capture());
        int n = 0;
        for (LancamentoFinanceiroEntity ignored : cap.getValue()) {
            n++;
        }
        assertThat(n).isEqualTo(2);
    }
}
