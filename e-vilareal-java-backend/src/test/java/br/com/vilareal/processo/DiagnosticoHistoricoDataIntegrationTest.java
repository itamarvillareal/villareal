package br.com.vilareal.processo;

import br.com.vilareal.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Relatório Diagnósticos «Consultas Realizadas» — endpoint {@code GET /diagnostico/historico-data}.
 */
class DiagnosticoHistoricoDataIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Test
    void historicoDataEndpointExisteERetornaLista() {
        String token = login();
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);

        ResponseEntity<List<Map<String, Object>>> res = rest.exchange(
                "/api/processos/diagnostico/historico-data?data=18/05/2026",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isNotNull();
    }

    @Test
    void historicoDataIncluiAndamentoNaDataMovimento() {
        String token = login();
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<List<Map<String, Object>>> clientes = rest.exchange(
                "/api/clientes",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});
        assertThat(clientes.getBody()).isNotEmpty();
        Long pessoaId = ((Number) clientes.getBody().get(0).get("id")).longValue();

        var processoBody = Map.of(
                "clienteId", pessoaId,
                "numeroInterno", 88,
                "numeroCnj", "5999999-99.2026.8.09.0007",
                "naturezaAcao", "Cível",
                "ativo", true,
                "consultaAutomatica", false);

        ResponseEntity<Map<String, Object>> created = rest.exchange(
                "/api/processos",
                HttpMethod.POST,
                new HttpEntity<>(processoBody, h),
                new ParameterizedTypeReference<>() {});
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long processoId = ((Number) created.getBody().get("id")).longValue();

        var andamento = new LinkedHashMap<String, Object>();
        andamento.put("movimentoEm", "2026-05-18T12:00:00.000Z");
        andamento.put("titulo", "TESTE DIAGNOSTICO CONSULTAS REALIZADAS");
        andamento.put("origem", "MANUAL");
        andamento.put("origemAutomatica", false);

        ResponseEntity<Map<String, Object>> criado = rest.exchange(
                "/api/processos/" + processoId + "/andamentos",
                HttpMethod.POST,
                new HttpEntity<>(andamento, h),
                new ParameterizedTypeReference<>() {});
        assertThat(criado.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        ResponseEntity<List<Map<String, Object>>> lista = rest.exchange(
                "/api/processos/diagnostico/historico-data?data=18/05/2026",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(lista.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(lista.getBody()).isNotNull();
        boolean achou = lista.getBody().stream()
                .anyMatch(row -> "TESTE DIAGNOSTICO CONSULTAS REALIZADAS"
                        .equals(String.valueOf(row.get("info")).trim()));
        assertThat(achou).as("andamento com movimento_em na data deve aparecer no relatório").isTrue();

        Long andamentoId = ((Number) criado.getBody().get("id")).longValue();
        rest.exchange(
                "/api/processos/" + processoId + "/andamentos/" + andamentoId,
                HttpMethod.DELETE,
                new HttpEntity<>(h),
                Void.class);
    }

    private String login() {
        var loginBody = Map.of("login", "itamar", "senha", "123456");
        ResponseEntity<Map<String, Object>> login = rest.exchange(
                "/api/auth/login",
                HttpMethod.POST,
                new HttpEntity<>(loginBody),
                new ParameterizedTypeReference<>() {});
        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        return (String) login.getBody().get("accessToken");
    }
}
