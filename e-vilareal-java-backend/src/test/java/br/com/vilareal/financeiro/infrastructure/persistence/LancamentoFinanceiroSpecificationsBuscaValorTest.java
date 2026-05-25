package br.com.vilareal.financeiro.infrastructure.persistence;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.domain.Specification;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LancamentoFinanceiroSpecificationsBuscaValorTest {

    @Test
    void interpretarValorBusca_inteiroParcial_cobreCentavos() throws Exception {
        Object faixa = invokeInterpretar("244").orElseThrow();
        assertNull(recordComponent(faixa, "exato"));
        assertEquals(new BigDecimal("244"), recordComponent(faixa, "minInclusive"));
        assertEquals(new BigDecimal("245"), recordComponent(faixa, "maxExclusive"));
    }

    @Test
    void interpretarValorBusca_valorCompleto_ptBr() throws Exception {
        Object faixa = invokeInterpretar("244,48").orElseThrow();
        assertEquals(new BigDecimal("244.48"), recordComponent(faixa, "exato"));
    }

    @Test
    void comBuscaDescricao_montaSpecification() {
        Specification<?> spec = LancamentoFinanceiroSpecifications.comBuscaDescricao("244");
        assertNotNull(spec);
    }

    @SuppressWarnings("unchecked")
    private static Optional<Object> invokeInterpretar(String term) throws Exception {
        Method m = LancamentoFinanceiroSpecifications.class.getDeclaredMethod("interpretarValorBusca", String.class);
        m.setAccessible(true);
        return (Optional<Object>) m.invoke(null, term);
    }

    private static Object recordComponent(Object record, String name) throws Exception {
        Method m = record.getClass().getDeclaredMethod(name);
        return m.invoke(record);
    }
}
