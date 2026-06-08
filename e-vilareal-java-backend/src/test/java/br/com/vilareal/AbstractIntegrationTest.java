package br.com.vilareal;

import br.com.vilareal.support.DockerCiGateExtension;
import br.com.vilareal.support.IntegrationTestMysql;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@ExtendWith(DockerCiGateExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {

    @DynamicPropertySource
    static void registerProps(DynamicPropertyRegistry r) {
        IntegrationTestMysql.ensureStarted();
        r.add("spring.datasource.url", IntegrationTestMysql.CONTAINER::getJdbcUrl);
        r.add("spring.datasource.username", IntegrationTestMysql.CONTAINER::getUsername);
        r.add("spring.datasource.password", IntegrationTestMysql.CONTAINER::getPassword);
    }
}
