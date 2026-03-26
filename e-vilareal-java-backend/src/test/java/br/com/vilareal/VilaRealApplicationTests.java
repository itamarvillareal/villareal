package br.com.vilareal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class VilaRealApplicationTests extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Test
    void contextLoads() {
        ResponseEntity<Map> health = rest.getForEntity("/actuator/health", Map.class);
        assertThat(health.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
