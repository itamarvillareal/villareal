package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinanceiroDescricaoNormBackfillServiceTest {

    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;

    @InjectMocks
    private FinanceiroDescricaoNormBackfillService service;

    @Test
    void backfill_preencheDescricaoNorm() {
        LancamentoFinanceiroEntity e = new LancamentoFinanceiroEntity();
        e.setDescricao("PIX TRANSF BANCO I09/06");
        when(lancamentoRepository.findByDescricaoNormIsNull(any(Pageable.class))).thenReturn(List.of(e));
        when(lancamentoRepository.countByDescricaoNormIsNull()).thenReturn(0L);

        var resp = service.backfill(100);

        assertThat(resp.getAtualizados()).isEqualTo(1);
        assertThat(resp.getRestantes()).isZero();
        assertThat(e.getDescricaoNorm()).isEqualTo("PIX TRANSF BANCO I");
        verify(lancamentoRepository).saveAll(List.of(e));
    }
}
