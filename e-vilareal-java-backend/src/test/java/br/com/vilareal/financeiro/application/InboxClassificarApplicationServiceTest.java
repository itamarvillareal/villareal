package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.LancamentoFinanceiroResponse;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InboxClassificarApplicationServiceTest {

    @Test
    void mesclarOrdenado_intercalaBancosECartoesPorDataDesc() {
        LancamentoFinanceiroResponse b1 = l(1L, LocalDate.of(2026, 6, 15));
        LancamentoFinanceiroResponse c1 = l(2L, LocalDate.of(2026, 6, 12));
        LancamentoFinanceiroResponse b2 = l(3L, LocalDate.of(2026, 6, 10));

        Sort sort = Sort.by(Sort.Direction.DESC, "dataLancamento").and(Sort.by(Sort.Direction.DESC, "id"));
        List<LancamentoFinanceiroResponse> merged =
                InboxClassificarApplicationService.mesclarOrdenado(List.of(b1, b2), List.of(c1), sort);

        assertThat(merged).extracting(LancamentoFinanceiroResponse::getId).containsExactly(1L, 2L, 3L);
    }

    private static LancamentoFinanceiroResponse l(Long id, LocalDate data) {
        LancamentoFinanceiroResponse r = new LancamentoFinanceiroResponse();
        r.setId(id);
        r.setDataLancamento(data);
        return r;
    }
}
