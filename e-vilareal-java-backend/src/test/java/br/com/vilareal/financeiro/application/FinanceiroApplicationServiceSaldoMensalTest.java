package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.SaldoInicialBancoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinanceiroApplicationServiceSaldoMensalTest {

    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;

    @Mock
    private SaldoInicialBancoRepository saldoInicialRepository;

    @InjectMocks
    private FinanceiroApplicationService service;

    @Test
    void saldoMensalPorDia_montaTodosOsDiasDoMes() {
        when(lancamentoRepository.sumSaldoAssinadoPorNumeroBancoAteData(1, LocalDate.of(2026, 4, 30)))
                .thenReturn(new BigDecimal("1000.00"));
        when(lancamentoRepository.sumMovimentoPorDiaNoPeriodo(
                        1, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31)))
                .thenReturn(List.of(
                        new Object[] {Date.valueOf("2026-05-10"), new BigDecimal("50.00"), 2L},
                        new Object[] {Date.valueOf("2026-05-11"), new BigDecimal("-30.00"), 1L}));

        var r = service.saldoMensalPorDia(1, 2026, 5);

        assertThat(r.getSaldoInicial()).isEqualByComparingTo("1000.00");
        assertThat(r.getDias()).hasSize(31);
        assertThat(r.getDias().get(0).getSaldo()).isEqualByComparingTo("1000.00");
        assertThat(r.getDias().get(9).getMovimento()).isEqualByComparingTo("50.00");
        assertThat(r.getDias().get(9).getSaldo()).isEqualByComparingTo("1050.00");
        assertThat(r.getDias().get(10).getSaldo()).isEqualByComparingTo("1020.00");
        assertThat(r.getDias().get(30).getSaldo()).isEqualByComparingTo("1020.00");
    }
}
