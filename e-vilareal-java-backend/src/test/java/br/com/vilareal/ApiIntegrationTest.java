package br.com.vilareal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ApiIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Test
    void loginAdminAndListPessoas() {
        var loginBody = Map.of("login", "admin", "senha", "password");
        ResponseEntity<Map<String, Object>> login = rest.exchange(
                "/api/auth/login",
                HttpMethod.POST,
                new HttpEntity<>(loginBody),
                new ParameterizedTypeReference<>() {});

        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(login.getBody()).isNotNull();
        assertThat(login.getBody().get("accessToken")).isNotNull();

        String token = (String) login.getBody().get("accessToken");
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        HttpEntity<Void> auth = new HttpEntity<>(h);

        ResponseEntity<List<Map<String, Object>>> list = rest.exchange(
                "/api/cadastro-pessoas",
                HttpMethod.GET,
                auth,
                new ParameterizedTypeReference<>() {});

        assertThat(list.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(list.getBody()).isNotEmpty();
    }

    @Test
    void criarPessoaUsuarioPatchAtivoPerfis() {
        String token = login();
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);

        var pessoa = Map.of(
                "nome", "Maria Silva",
                "cpf", "11144477735",
                "email", "maria@test.local",
                "ativo", true,
                "marcadoMonitoramento", false);

        ResponseEntity<Map<String, Object>> created = rest.exchange(
                "/api/cadastro-pessoas",
                HttpMethod.POST,
                new HttpEntity<>(pessoa, h),
                new ParameterizedTypeReference<>() {});

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long pessoaId = ((Number) created.getBody().get("id")).longValue();

        var usuario = Map.of(
                "pessoaId", pessoaId,
                "nome", "Maria Silva",
                "apelido", "Maria",
                "login", "maria",
                "senha", "abcd1234",
                "ativo", true);

        ResponseEntity<Map<String, Object>> uCreated = rest.exchange(
                "/api/usuarios",
                HttpMethod.POST,
                new HttpEntity<>(usuario, h),
                new ParameterizedTypeReference<>() {});

        assertThat(uCreated.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long usuarioId = ((Number) uCreated.getBody().get("id")).longValue();

        ResponseEntity<Map<String, Object>> patch = rest.exchange(
                "/api/usuarios/" + usuarioId + "/ativo?value=false",
                HttpMethod.PATCH,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(patch.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(patch.getBody().get("ativo")).isEqualTo(false);

        List<Long> perfis = List.of(2L);
        ResponseEntity<Map<String, Object>> putPerfis = rest.exchange(
                "/api/usuarios/" + usuarioId + "/perfis",
                HttpMethod.PUT,
                new HttpEntity<>(perfis, h),
                new ParameterizedTypeReference<>() {});

        assertThat(putPerfis.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        List<Number> ids = (List<Number>) putPerfis.getBody().get("perfilIds");
        assertThat(ids).extracting(Number::longValue).containsExactly(2L);
    }

    @Test
    void agendaListarCriarAtualizar() {
        String token = login();
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<List<Map<String, Object>>> vazio = rest.exchange(
                "/api/agenda/eventos?usuarioId=1&dataInicio=2026-03-10&dataFim=2026-03-10",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(vazio.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(vazio.getBody()).isNotNull();
        assertThat(vazio.getBody()).isEmpty();

        var novo = Map.of(
                "usuarioId", 1,
                "dataEvento", "2026-03-10",
                "horaEvento", "14:30",
                "descricao", "Audiência teste",
                "statusCurto", "OK",
                "processoRef", null,
                "origem", "frontend-agenda");

        ResponseEntity<Map<String, Object>> created = rest.exchange(
                "/api/agenda/eventos",
                HttpMethod.POST,
                new HttpEntity<>(novo, h),
                new ParameterizedTypeReference<>() {});

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody()).isNotNull();
        Long eventoId = ((Number) created.getBody().get("id")).longValue();

        ResponseEntity<List<Map<String, Object>>> lista = rest.exchange(
                "/api/agenda/eventos?usuarioId=1&dataInicio=2026-03-10&dataFim=2026-03-10",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(lista.getBody()).hasSize(1);
        assertThat(lista.getBody().get(0).get("descricao")).isEqualTo("Audiência teste");

        var patch = Map.of(
                "usuarioId", 1,
                "dataEvento", "2026-03-10",
                "horaEvento", "15:00",
                "descricao", "Audiência alterada",
                "statusCurto", "",
                "processoRef", null,
                "origem", "frontend-agenda");

        ResponseEntity<Map<String, Object>> put = rest.exchange(
                "/api/agenda/eventos/" + eventoId,
                HttpMethod.PUT,
                new HttpEntity<>(patch, h),
                new ParameterizedTypeReference<>() {});

        assertThat(put.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(put.getBody().get("horaEvento")).isEqualTo("15:00");
        assertThat(put.getBody().get("descricao")).isEqualTo("Audiência alterada");
    }

    @Test
    void duplicateCpfReturns422() {
        String token = login();
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);

        var body = Map.of(
                "nome", "Dup",
                "cpf", "39053344705",
                "ativo", true);

        rest.exchange("/api/cadastro-pessoas", HttpMethod.POST, new HttpEntity<>(body, h), Map.class);
        ResponseEntity<Map<String, Object>> second = rest.exchange(
                "/api/cadastro-pessoas",
                HttpMethod.POST,
                new HttpEntity<>(body, h),
                new ParameterizedTypeReference<>() {});

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
    }

    private String login() {
        var loginBody = Map.of("login", "admin", "senha", "password");
        ResponseEntity<Map<String, Object>> login = rest.exchange(
                "/api/auth/login",
                HttpMethod.POST,
                new HttpEntity<>(loginBody),
                new ParameterizedTypeReference<>() {});
        return (String) login.getBody().get("accessToken");
    }
}
