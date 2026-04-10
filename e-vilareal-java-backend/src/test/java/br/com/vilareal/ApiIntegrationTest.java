package br.com.vilareal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ApiIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Test
    void loginAdminAndListPessoas() {
        var loginBody = Map.of("login", "itamar", "senha", "123456");
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
        assertThat(((Number) putPerfis.getBody().get("perfilId")).longValue()).isEqualTo(2L);
    }

    @Test
    void agendaListarCriarAtualizar() {
        String token = login();
        long usuarioAgenda = usuarioIdParaLoginItamar(token);
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<List<Map<String, Object>>> vazio = rest.exchange(
                "/api/agenda/eventos?usuarioId="
                        + usuarioAgenda
                        + "&dataInicio=2026-03-10&dataFim=2026-03-10",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(vazio.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(vazio.getBody()).isNotNull();
        assertThat(vazio.getBody()).isEmpty();

        var novo = Map.of(
                "usuarioId", usuarioAgenda,
                "dataEvento", "2026-03-10",
                "horaEvento", "14:30",
                "descricao", "Audiência teste",
                "statusCurto", "OK",
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
                "/api/agenda/eventos?usuarioId="
                        + usuarioAgenda
                        + "&dataInicio=2026-03-10&dataFim=2026-03-10",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(lista.getBody()).hasSize(1);
        assertThat(lista.getBody().get(0).get("descricao")).isEqualTo("Audiência teste");

        ResponseEntity<List<Map<String, Object>>> todosUsuarios = rest.exchange(
                "/api/agenda/eventos?todosUsuarios=true&dataInicio=2026-03-10&dataFim=2026-03-10",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(todosUsuarios.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(todosUsuarios.getBody()).isNotNull();
        assertThat(todosUsuarios.getBody()).hasSize(1);
        assertThat(todosUsuarios.getBody().get(0).get("descricao")).isEqualTo("Audiência teste");

        var patch = Map.of(
                "usuarioId", usuarioAgenda,
                "dataEvento", "2026-03-10",
                "horaEvento", "15:00",
                "descricao", "Audiência alterada",
                "statusCurto", "",
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
    void topicosHierarchyRetornaRaizMinima() {
        String token = login();
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);

        ResponseEntity<Map<String, Object>> res = rest.exchange(
                "/api/topicos/hierarchy",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isNotNull();
        assertThat(res.getBody().get("id")).isEqualTo("_raiz");
        assertThat(res.getBody().get("label")).isEqualTo("Início");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> children = (List<Map<String, Object>>) res.getBody().get("children");
        assertThat(children).isNotNull();
    }

    @Test
    void auditoriaRegistrarEListarPaginado() {
        String token = login();
        long uid = usuarioIdParaLoginItamar(token);
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);
        h.set("X-VilaReal-Usuario-Id", String.valueOf(uid));
        h.set(
                "X-VilaReal-Usuario-Nome-B64",
                Base64.getEncoder().encodeToString("Admin Seed".getBytes(StandardCharsets.UTF_8)));

        var body = Map.of(
                "usuarioId", String.valueOf(uid),
                "usuarioNome", "Administrador",
                "modulo", "Início (Quadro)",
                "tela", "/",
                "tipoAcao", "ACESSO_TELA",
                "descricao", "Teste de auditoria (integração)");

        ResponseEntity<Map<String, Object>> post = rest.exchange(
                "/api/auditoria/atividades",
                HttpMethod.POST,
                new HttpEntity<>(body, h),
                new ParameterizedTypeReference<>() {});

        assertThat(post.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(post.getBody()).isNotNull();
        assertThat(post.getBody().get("modulo")).isEqualTo("Início (Quadro)");
        assertThat(post.getBody().get("tipoAcao")).isEqualTo("ACESSO_TELA");

        h = new HttpHeaders();
        h.setBearerAuth(token);
        HttpEntity<Void> auth = new HttpEntity<>(h);

        ResponseEntity<Map<String, Object>> page = rest.exchange(
                "/api/auditoria/atividades?page=0&size=10&sort=ocorridoEm,desc&q=integração",
                HttpMethod.GET,
                auth,
                new ParameterizedTypeReference<>() {});

        assertThat(page.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(page.getBody()).isNotNull();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) page.getBody().get("content");
        assertThat(content).isNotEmpty();
        assertThat(content.get(0).get("descricao")).isEqualTo("Teste de auditoria (integração)");
    }

    @Test
    void tarefasOperacionaisCriarListarAtualizarPatchStatus() {
        String token = login();
        long respId = usuarioIdParaLoginItamar(token);
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<List<Map<String, Object>>> vazio = rest.exchange(
                "/api/tarefas",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(vazio.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(vazio.getBody()).isNotNull();
        assertThat(vazio.getBody()).isEmpty();

        var criar = Map.of(
                "titulo", "Petição inicial",
                "descricao", "Detalhes\nsegunda linha",
                "responsavelUsuarioId", respId,
                "prioridade", "ALTA");

        ResponseEntity<Map<String, Object>> created = rest.exchange(
                "/api/tarefas",
                HttpMethod.POST,
                new HttpEntity<>(criar, h),
                new ParameterizedTypeReference<>() {});

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody()).isNotNull();
        Long tarefaId = ((Number) created.getBody().get("id")).longValue();
        assertThat(((Number) created.getBody().get("responsavelUsuarioId")).longValue()).isEqualTo(respId);
        assertThat(created.getBody().get("status")).isEqualTo("PENDENTE");

        ResponseEntity<List<Map<String, Object>>> porResp = rest.exchange(
                "/api/tarefas?responsavelId=" + respId,
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(porResp.getBody()).hasSize(1);

        var put = Map.of(
                "titulo", "Petição inicial (editado)",
                "descricao", "Novo texto",
                "responsavelUsuarioId", respId,
                "status", "EM_ANDAMENTO",
                "prioridade", "NORMAL");

        ResponseEntity<Map<String, Object>> atualizado = rest.exchange(
                "/api/tarefas/" + tarefaId,
                HttpMethod.PUT,
                new HttpEntity<>(put, h),
                new ParameterizedTypeReference<>() {});

        assertThat(atualizado.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(atualizado.getBody().get("titulo")).isEqualTo("Petição inicial (editado)");
        assertThat(atualizado.getBody().get("status")).isEqualTo("EM_ANDAMENTO");

        var patch = Map.of("status", "CONCLUIDA");

        ResponseEntity<Map<String, Object>> concl = rest.exchange(
                "/api/tarefas/" + tarefaId + "/status",
                HttpMethod.PATCH,
                new HttpEntity<>(patch, h),
                new ParameterizedTypeReference<>() {});

        assertThat(concl.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(concl.getBody().get("status")).isEqualTo("CONCLUIDA");
        assertThat(concl.getBody().get("dataConclusao")).isNotNull();

        ResponseEntity<Map<String, Object>> uma = rest.exchange(
                "/api/tarefas/" + tarefaId,
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(uma.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(((Number) uma.getBody().get("id")).longValue()).isEqualTo(tarefaId);
    }

    @Test
    void processosClientesPartesAndamentosPrazos() {
        String token = login();
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<List<Map<String, Object>>> clientes = rest.exchange(
                "/api/clientes",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(clientes.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(clientes.getBody()).isNotEmpty();
        Map<String, Object> primeiroCliente = clientes.getBody().get(0);
        Long pessoaId = ((Number) primeiroCliente.get("id")).longValue();
        String cod8 = (String) primeiroCliente.get("codigoCliente");

        var processoBody = Map.of(
                "clienteId", pessoaId,
                "numeroInterno", 77,
                "numeroCnj", "5000000-00.0000.0.00.0000",
                "naturezaAcao", "Cível",
                "competencia", "Federal",
                "fase", "Conhecimento",
                "ativo", true,
                "consultaAutomatica", false,
                "uf", "SP",
                "cidade", "São Paulo");

        ResponseEntity<Map<String, Object>> created = rest.exchange(
                "/api/processos",
                HttpMethod.POST,
                new HttpEntity<>(processoBody, h),
                new ParameterizedTypeReference<>() {});

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long procId = ((Number) created.getBody().get("id")).longValue();
        assertThat(created.getBody().get("codigoCliente")).isEqualTo(cod8);

        ResponseEntity<List<Map<String, Object>>> lista = rest.exchange(
                "/api/processos?codigoCliente=" + cod8,
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(lista.getBody().stream().anyMatch(m -> procId.equals(((Number) m.get("id")).longValue())))
                .isTrue();

        Map<String, Object> parte = new LinkedHashMap<>();
        parte.put("pessoaId", pessoaId);
        parte.put("polo", "AUTOR");
        parte.put("qualificacao", "Parte cliente");
        parte.put("ordem", 0);

        ResponseEntity<Map<String, Object>> parteCriada = rest.exchange(
                "/api/processos/" + procId + "/partes",
                HttpMethod.POST,
                new HttpEntity<>(parte, h),
                new ParameterizedTypeReference<>() {});

        assertThat(parteCriada.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        ResponseEntity<List<Map<String, Object>>> partes = rest.exchange(
                "/api/processos/" + procId + "/partes",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(partes.getBody()).hasSize(1);

        var andamento = Map.of(
                "movimentoEm", "2026-03-20T12:00:00Z",
                "titulo", "Petição juntada",
                "origem", "MANUAL",
                "origemAutomatica", false);

        ResponseEntity<Map<String, Object>> andCriado = rest.exchange(
                "/api/processos/" + procId + "/andamentos",
                HttpMethod.POST,
                new HttpEntity<>(andamento, h),
                new ParameterizedTypeReference<>() {});

        assertThat(andCriado.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        var prazo = Map.of(
                "descricao", "Prazo fatal do processo",
                "dataFim", "2026-12-31",
                "prazoFatal", true,
                "status", "PENDENTE");

        ResponseEntity<Map<String, Object>> prazoCriado = rest.exchange(
                "/api/processos/" + procId + "/prazos",
                HttpMethod.POST,
                new HttpEntity<>(prazo, h),
                new ParameterizedTypeReference<>() {});

        assertThat(prazoCriado.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(prazoCriado.getBody().get("prazoFatal")).isEqualTo(true);

        ResponseEntity<Void> patch = rest.exchange(
                "/api/processos/" + procId + "/ativo?value=false",
                HttpMethod.PATCH,
                new HttpEntity<>(h),
                Void.class);

        assertThat(patch.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<Map<String, Object>> busca = rest.exchange(
                "/api/processos/" + procId,
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(busca.getBody().get("ativo")).isEqualTo(false);
    }

    @Test
    void financeiroContasLancamentosResumoCrud() {
        String token = login();
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<List<Map<String, Object>>> contas = rest.exchange(
                "/api/financeiro/contas",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(contas.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(contas.getBody()).isNotEmpty();
        Map<String, Object> contaA = contas.getBody().stream()
                .filter(m -> "A".equals(m.get("codigo")))
                .findFirst()
                .orElseThrow();
        Long contaEscritorioId = ((Number) contaA.get("id")).longValue();

        ResponseEntity<List<Map<String, Object>>> clientes = rest.exchange(
                "/api/clientes",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        Long pessoaId = ((Number) clientes.getBody().get(0).get("id")).longValue();

        var processoBody = Map.of(
                "clienteId", pessoaId,
                "numeroInterno", 88,
                "naturezaAcao", "Cível",
                "ativo", true,
                "consultaAutomatica", false);

        ResponseEntity<Map<String, Object>> procCreated = rest.exchange(
                "/api/processos",
                HttpMethod.POST,
                new HttpEntity<>(processoBody, h),
                new ParameterizedTypeReference<>() {});

        assertThat(procCreated.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long procId = ((Number) procCreated.getBody().get("id")).longValue();

        Map<String, Object> lanc = new LinkedHashMap<>();
        lanc.put("contaContabilId", contaEscritorioId);
        lanc.put("clienteId", pessoaId);
        lanc.put("processoId", procId);
        lanc.put("bancoNome", "CEF");
        lanc.put("numeroBanco", 5);
        lanc.put("numeroLancamento", "fin-int-1");
        lanc.put("dataLancamento", "2026-03-15");
        lanc.put("dataCompetencia", "2026-03-15");
        lanc.put("descricao", "Crédito teste");
        lanc.put("descricaoDetalhada", "detalhe");
        lanc.put("valor", 100.5);
        lanc.put("natureza", "CREDITO");
        lanc.put("refTipo", "N");
        lanc.put("origem", "MANUAL");
        lanc.put("status", "ATIVO");

        ResponseEntity<Map<String, Object>> postL = rest.exchange(
                "/api/financeiro/lancamentos",
                HttpMethod.POST,
                new HttpEntity<>(lanc, h),
                new ParameterizedTypeReference<>() {});

        assertThat(postL.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long lancId = ((Number) postL.getBody().get("id")).longValue();
        assertThat(postL.getBody().get("contaContabilNome")).isEqualTo("Conta Escritório");
        assertThat(((Number) postL.getBody().get("clienteId")).longValue()).isEqualTo(pessoaId);
        assertThat(((Number) postL.getBody().get("processoId")).longValue()).isEqualTo(procId);
        assertThat(postL.getBody().get("codigoCliente")).isEqualTo(String.format("%08d", pessoaId));
        assertThat(((Number) postL.getBody().get("numeroInternoProcesso")).intValue()).isEqualTo(88);
        assertThat(postL.getBody().get("dataCompetencia")).isEqualTo("2026-03-15");

        ResponseEntity<Map<String, Object>> resumo = rest.exchange(
                "/api/financeiro/lancamentos/resumo-processo/" + procId,
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(resumo.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(((Number) resumo.getBody().get("totalLancamentos")).longValue()).isEqualTo(1L);
        assertThat(new BigDecimal(resumo.getBody().get("saldo").toString())).isEqualByComparingTo("100.50");

        ResponseEntity<List<Map<String, Object>>> porProc = rest.exchange(
                "/api/financeiro/lancamentos?processoId=" + procId,
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(porProc.getBody()).hasSize(1);

        lanc.put("descricao", "Crédito teste (editado)");
        lanc.put("valor", 80.0);
        lanc.put("natureza", "CREDITO");

        ResponseEntity<Map<String, Object>> putL = rest.exchange(
                "/api/financeiro/lancamentos/" + lancId,
                HttpMethod.PUT,
                new HttpEntity<>(lanc, h),
                new ParameterizedTypeReference<>() {});

        assertThat(putL.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(putL.getBody().get("descricao")).isEqualTo("Crédito teste (editado)");

        ResponseEntity<Void> del = rest.exchange(
                "/api/financeiro/lancamentos/" + lancId,
                HttpMethod.DELETE,
                new HttpEntity<>(h),
                Void.class);

        assertThat(del.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<Map<String, Object>> resumo2 = rest.exchange(
                "/api/financeiro/lancamentos/resumo-processo/" + procId,
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(((Number) resumo2.getBody().get("totalLancamentos")).longValue()).isZero();
    }

    @Test
    void financeiroLimparExtratoCefJsonRemovePorNomeENumeroBanco() {
        String token = login();
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<List<Map<String, Object>>> contas = rest.exchange(
                "/api/financeiro/contas",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(contas.getBody()).isNotEmpty();
        Long contaNId = contas.getBody().stream()
                .filter(m -> "N".equals(m.get("codigo")))
                .map(m -> ((Number) m.get("id")).longValue())
                .findFirst()
                .orElseThrow();

        String pfx = "limpar-cef-json-";

        java.util.function.BiConsumer<String, Map<String, Object>> postLanc = (suffix, extra) -> {
            Map<String, Object> lanc = new LinkedHashMap<>();
            lanc.put("contaContabilId", contaNId);
            lanc.put("numeroLancamento", pfx + suffix);
            lanc.put("dataLancamento", "2026-04-01");
            lanc.put("dataCompetencia", "2026-04-01");
            lanc.put("descricao", "teste limpar CEF");
            lanc.put("descricaoDetalhada", "");
            lanc.put("valor", 1.0);
            lanc.put("natureza", "CREDITO");
            lanc.put("refTipo", "N");
            lanc.put("origem", "OFX");
            lanc.put("status", "ATIVO");
            lanc.putAll(extra);
            ResponseEntity<Map<String, Object>> created = rest.exchange(
                    "/api/financeiro/lancamentos",
                    HttpMethod.POST,
                    new HttpEntity<>(lanc, h),
                    new ParameterizedTypeReference<>() {});
            assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        };

        postLanc.accept("a", Map.of("bancoNome", "CEF", "numeroBanco", 5));
        postLanc.accept("b", Map.of("bancoNome", "rótulo errado", "numeroBanco", 5));
        postLanc.accept("c", Map.of("bancoNome", "CEF"));
        postLanc.accept("itau", Map.of("bancoNome", "Itaú", "numeroBanco", 1));

        ResponseEntity<List<Map<String, Object>>> antes = rest.exchange(
                "/api/financeiro/lancamentos",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});
        long nAntes = antes.getBody().stream()
                .filter(m -> String.valueOf(m.get("numeroLancamento")).startsWith(pfx))
                .count();
        assertThat(nAntes).isEqualTo(4L);

        Map<String, Object> limparBody = Map.of("banco", "CEF", "numeroBanco", 5);
        ResponseEntity<Map<String, Object>> limp = rest.exchange(
                "/api/financeiro/lancamentos/limpar-extrato",
                HttpMethod.POST,
                new HttpEntity<>(limparBody, h),
                new ParameterizedTypeReference<>() {});

        assertThat(limp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(limp.getBody()).isNotNull();
        assertThat(((Number) limp.getBody().get("lancamentosRemovidos")).intValue()).isGreaterThanOrEqualTo(3);

        ResponseEntity<List<Map<String, Object>>> depois = rest.exchange(
                "/api/financeiro/lancamentos",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});

        assertThat(depois.getBody().stream()
                .filter(m -> String.valueOf(m.get("numeroLancamento")).startsWith(pfx))
                .count()).isEqualTo(1L);
        assertThat(depois.getBody().stream()
                .filter(m -> pfx.concat("itau").equals(String.valueOf(m.get("numeroLancamento"))))
                .count()).isEqualTo(1L);
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
        var loginBody = Map.of("login", "itamar", "senha", "123456");
        ResponseEntity<Map<String, Object>> login = rest.exchange(
                "/api/auth/login",
                HttpMethod.POST,
                new HttpEntity<>(loginBody),
                new ParameterizedTypeReference<>() {});
        return (String) login.getBody().get("accessToken");
    }

    private long usuarioIdParaLoginItamar(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        ResponseEntity<List<Map<String, Object>>> r = rest.exchange(
                "/api/usuarios",
                HttpMethod.GET,
                new HttpEntity<>(h),
                new ParameterizedTypeReference<>() {});
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(r.getBody()).isNotNull();
        return r.getBody().stream()
                .filter(m -> "itamar".equalsIgnoreCase(String.valueOf(m.getOrDefault("login", ""))))
                .map(m -> ((Number) m.get("id")).longValue())
                .findFirst()
                .orElseThrow(() -> new AssertionError("login itamar não encontrado em GET /api/usuarios"));
    }
}
