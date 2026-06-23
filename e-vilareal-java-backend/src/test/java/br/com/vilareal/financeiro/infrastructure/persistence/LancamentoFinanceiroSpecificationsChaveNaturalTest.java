package br.com.vilareal.financeiro.infrastructure.persistence;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.domain.Specification;

import static org.assertj.core.api.Assertions.assertThat;

class LancamentoFinanceiroSpecificationsChaveNaturalTest {

    @Test
    void comCodigoClienteExibicao_vazio_retornaNull() {
        assertThat(LancamentoFinanceiroSpecifications.comCodigoClienteExibicao(null, null, null)).isNull();
        assertThat(LancamentoFinanceiroSpecifications.comCodigoClienteExibicao("  ", null, null)).isNull();
    }

    @Test
    void comCodigoClienteExibicao_comClientePk_retornaSpec() {
        Specification<?> spec = LancamentoFinanceiroSpecifications.comCodigoClienteExibicao("00000728", 42L, null);
        assertThat(spec).isNotNull();
    }

    @Test
    void comProcExibicao_vazio_retornaNull() {
        assertThat(LancamentoFinanceiroSpecifications.comProcExibicao(null)).isNull();
    }

    @Test
    void comProcExibicao_zeroOuPositivo_retornaSpec() {
        assertThat(LancamentoFinanceiroSpecifications.comProcExibicao(0)).isNotNull();
        assertThat(LancamentoFinanceiroSpecifications.comProcExibicao(118)).isNotNull();
    }
}
