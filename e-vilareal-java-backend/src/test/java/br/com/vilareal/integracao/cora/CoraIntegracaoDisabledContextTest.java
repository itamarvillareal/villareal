package br.com.vilareal.integracao.cora;

import br.com.vilareal.integracao.cora.api.CoraIntegracaoController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Slice mínimo: com {@code cora.enabled=false}, beans de produção Cora não sobem.
 */
@SpringBootTest(
        classes = {
            CoraPropertiesConfiguration.class,
            CoraIntegracaoController.class,
        })
@TestPropertySource(properties = "cora.enabled=false")
class CoraIntegracaoDisabledContextTest {

    @Autowired
    private org.springframework.context.ApplicationContext applicationContext;

    @Test
    void beansCoraProducaoAusentesQuandoDesligado() {
        assertThat(applicationContext.getBeansOfType(CoraClient.class)).isEmpty();
        assertThat(applicationContext.getBeansOfType(CoraTokenService.class)).isEmpty();
        assertThat(applicationContext.getBeansOfType(CoraHealthService.class)).isEmpty();
        assertThat(applicationContext.getBeansOfType(CoraMtlsHttpClient.class)).isEmpty();
        assertThat(applicationContext.getBeansOfType(CoraConfiguration.class)).isEmpty();
    }

    @Test
    void controllerHealthRegistrado() {
        assertThat(applicationContext.getBeansOfType(CoraIntegracaoController.class)).hasSize(1);
    }

    @Test
    void propriedadesCoraCarregadasDesligadas() {
        CoraProperties props = applicationContext.getBean(CoraProperties.class);
        assertThat(props.isEnabled()).isFalse();
    }

    @Test
    void healthRetornaDisabledSemConectar() {
        CoraIntegracaoController controller = applicationContext.getBean(CoraIntegracaoController.class);
        CoraHealthResult health = controller.health();
        assertThat(health.isEnabled()).isFalse();
    }
}
