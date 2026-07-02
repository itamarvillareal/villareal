package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.application.FinanceiroExtratoAcessoService;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.SaldoInicialBancoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinanceiroApplicationServiceSaldoNaDataTest {

    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;

    @Mock
    private SaldoInicialBancoRepository saldoInicialRepository;

    @Mock
    private FinanceiroExtratoAcessoService extratoAcessoService;

    @InjectMocks
    private FinanceiroApplicationService service;

    @Test
    void saldoPorNumeroBanco_comData_usaAgregadosAteDia() {
        LocalDate ref = LocalDate.of(2026, 5, 11);
        when(lancamentoRepository.sumSaldoAssinadoPorNumeroBancoAteData(1, ref))
                .thenReturn(new BigDecimal("1500.25"));
        when(lancamentoRepository.sumSaldoAssinadoPorNumeroBancoNoDia(1, ref))
                .thenReturn(new BigDecimal("-42.00"));
        when(lancamentoRepository.countByNumeroBancoAteData(1, ref)).thenReturn(120L);
        when(lancamentoRepository.countByNumeroBancoNoDia(1, ref)).thenReturn(3L);
        when(lancamentoRepository.findDataUltimoLancamentoPorNumeroBanco(1)).thenReturn(LocalDate.of(2026, 5, 15));
        when(lancamentoRepository.countByNumeroBanco(1)).thenReturn(125L);

        var r = service.saldoPorNumeroBanco(1, ref);

        assertThat(r.getDataReferencia()).isEqualTo(ref);
        assertThat(r.getSaldo()).isEqualByComparingTo("1500.25");
        assertThat(r.getMovimentoNoDia()).isEqualByComparingTo("-42.00");
        assertThat(r.getLancamentosAteData()).isEqualTo(120L);
        assertThat(r.getLancamentosNoDia()).isEqualTo(3L);
        verify(lancamentoRepository).sumSaldoAssinadoPorNumeroBancoAteData(1, ref);
    }
}
