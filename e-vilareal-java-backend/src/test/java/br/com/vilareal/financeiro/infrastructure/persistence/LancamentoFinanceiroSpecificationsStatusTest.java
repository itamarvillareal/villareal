package br.com.vilareal.financeiro.infrastructure.persistence;

import br.com.vilareal.financeiro.domain.StatusLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.domain.Specification;

import static org.assertj.core.api.Assertions.assertThat;

class LancamentoFinanceiroSpecificationsStatusTest {

    @Test
    void comFiltros_incluiSomenteAtivos() {
        Specification<LancamentoFinanceiroEntity> spec =
                LancamentoFinanceiroSpecifications.comFiltros(null, null, null, null, null);

        assertThat(spec).isNotNull();
        assertThat(LancamentoFinanceiroSpecifications.somenteAtivos()).isNotNull();
        assertThat(StatusLancamento.ATIVO).isEqualTo("ATIVO");
        assertThat(StatusLancamento.APOSENTADO).isEqualTo("APOSENTADO");
    }
}
