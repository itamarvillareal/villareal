package br.com.vilareal.financeiro.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Dry-run local contra vilareal-db (profile dev). Não grava — só imprime simulação.
 * Rodar: SPRING_PROFILES_ACTIVE=dev ./mvnw -q test -Dtest=HonorariosRedeSegurancaDryRunTest
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("dev")
class HonorariosRedeSegurancaDryRunTest {

    @Autowired
    private ExtratoPosImportApplicationService extratoPosImportApplicationService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void dryRunRedeSegurancaHonorarios() throws Exception {
        var result = extratoPosImportApplicationService.simularRedeSegurancaHonorarios();
        System.out.println("=== DRY-RUN rede segurança honorários (read-only) ===");
        System.out.println(objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(result));
    }
}
