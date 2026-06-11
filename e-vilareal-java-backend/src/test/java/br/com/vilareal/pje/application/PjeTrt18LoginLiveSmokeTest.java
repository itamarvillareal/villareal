package br.com.vilareal.pje.application;

import br.com.vilareal.pje.domain.PjeGrau;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.util.StringUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Smoke ao vivo: login real no PJe TRT18 via Playwright + TOTP cadastrado.
 *
 * <p>Não roda no build padrão. Exige Chromium instalado e credenciais reais:</p>
 * <pre>
 *   mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="install chromium"
 *   mvn test -Dtest=PjeTrt18LoginLiveSmokeTest \
 *     -Dvilareal.smoke.pje=true \
 *     -DPJE_SMOKE_LOGIN=SEU_LOGIN \
 *     -DPJE_SMOKE_SENHA=SUA_SENHA
 * </pre>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("dev")
@EnabledIfSystemProperty(named = "vilareal.smoke.pje", matches = "true")
class PjeTrt18LoginLiveSmokeTest {

    @Autowired
    private PjeLoginOrchestrator loginOrchestrator;

    @DynamicPropertySource
    static void habilitarPlaywright(DynamicPropertyRegistry registry) {
        registry.add("app.pje.browser.enabled", () -> "true");
        registry.add("app.pje.browser.headless", () -> System.getProperty("PJE_BROWSER_HEADLESS", "true"));
    }

    @Test
    void loginRealTrt18PrimeiroGrau() {
        String login = System.getProperty("PJE_SMOKE_LOGIN", System.getenv("PJE_SMOKE_LOGIN"));
        String senha = System.getProperty("PJE_SMOKE_SENHA", System.getenv("PJE_SMOKE_SENHA"));
        Assumptions.assumeTrue(
                StringUtils.hasText(login) && StringUtils.hasText(senha),
                "Defina PJE_SMOKE_LOGIN e PJE_SMOKE_SENHA (system property ou env)");

        Optional<PjeLoginResult> resultado =
                loginOrchestrator.executarLogin(PjeGrau.PRIMEIRO_GRAU, login.trim(), senha);

        assertThat(resultado).isPresent();
        assertThat(resultado.get().sucesso())
                .as("mensagem: %s", resultado.get().mensagem())
                .isTrue();
        assertThat(resultado.get().estadoFinal()).isEqualTo(PjeBrowserSessionState.AUTENTICADO);
    }
}
