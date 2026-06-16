package br.com.vilareal.projudi;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.projudi.application.ProjudiCredencialService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.HttpCookie;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Autentica no PROJUDI-GO via {@link HttpClient} puro (sem browser) e mantém a
 * sessão reaproveitável por credencial.
 *
 * <p><b>REGRA RÍGIDA — SOMENTE LEITURA:</b> este serviço expõe apenas acesso GET
 * ({@link #getAutenticado}). Não existe — e não deve existir — nenhum método que
 * faça POST a endpoints de ciência/peticionamento. Os únicos POSTs são internos,
 * exclusivamente para o handshake de login (LogOn).</p>
 *
 * <p><b>Segurança de log:</b> senha e token nunca são logados. Loga-se apenas CPF
 * mascarado, status HTTP e urlRedirect.</p>
 *
 * <p><b>Sem retry de OTP:</b> falhas de OTP/validação lançam exceção e param. O
 * backoff fica a cargo do orquestrador (ShedLock), para não estourar o limite de
 * reenvios do tribunal.</p>
 */
@Service
public class ProjudiSessionService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiSessionService.class);

    private static final String USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";
    private static final String ORIGIN = "https://projudi.tjgo.jus.br";
    private static final String REFERER = "https://projudi.tjgo.jus.br/";
    private static final String LOGON_PATH = "LogOn";
    /** ÚNICO path autorizado para POST de consulta (barreira anti-ciência). */
    private static final String BUSCA_PROCESSO_PATH = "BuscaProcesso";
    private static final String BUSCA_PROCESSO_REFERER = "https://projudi.tjgo.jus.br/BuscaProcesso";
    /** Paths autorizados para POST de escrita (peticionamento). */
    public static final Set<String> PETICIONAMENTO_PATHS = Set.of("Peticionamento", "InsercaoArquivo");
    private static final String INSERCAO_ARQUIVO_PATH = "InsercaoArquivo";
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(15);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);
    private static final Duration OTP_TIMEOUT = Duration.ofMinutes(2);
    private static final int MAX_TENTATIVAS_HTTP = 3;

    private final ProjudiCredencialService credencialService;
    private final ProjudiTokenReaderService tokenReader;
    private final ProjudiSessionStore sessionStore;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final long ttlMin;
    private final int quantidadeRegistrosPagina;

    private final ConcurrentHashMap<Long, ProjudiSession> cache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, Object> locks = new ConcurrentHashMap<>();

    public ProjudiSessionService(
            ProjudiCredencialService credencialService,
            ProjudiTokenReaderService tokenReader,
            ProjudiSessionStore sessionStore,
            ObjectMapper objectMapper,
            @Value("${projudi.base-url:https://projudi.tjgo.jus.br/}") String baseUrl,
            @Value("${projudi.session.ttl-min:25}") long ttlMin,
            @Value("${projudi.consulta.quantidade-registros-pagina:1000}") int quantidadeRegistrosPagina) {
        this.credencialService = credencialService;
        this.tokenReader = tokenReader;
        this.sessionStore = sessionStore;
        this.objectMapper = objectMapper;
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
        this.ttlMin = ttlMin;
        this.quantidadeRegistrosPagina = quantidadeRegistrosPagina > 0 ? quantidadeRegistrosPagina : 1000;
    }

    // ------------------------------------------------------------------
    // Sessão
    // ------------------------------------------------------------------

    /**
     * Devolve uma sessão válida: reaproveita a do cache se mais nova que o TTL,
     * senão tenta cookies persistidos em disco; por último autentica. A autenticação
     * é serializada por credencial (lock por credencialId) para nunca disparar dois
     * OTP em paralelo.
     */
    public ProjudiSession getSessao(Long credencialId) {
        if (credencialId == null) {
            throw new BusinessRuleException("credencialId é obrigatório.");
        }
        ProjudiSession atual = cache.get(credencialId);
        if (sessaoValidaEmMemoria(atual)) {
            return atual;
        }
        Object lock = locks.computeIfAbsent(credencialId, k -> new Object());
        synchronized (lock) {
            ProjudiSession revalidada = cache.get(credencialId);
            if (sessaoValidaEmMemoria(revalidada)) {
                return revalidada;
            }
            Optional<ProjudiSession> restaurada = restaurarSessaoPersistida(credencialId);
            if (restaurada.isPresent()) {
                cache.put(credencialId, restaurada.get());
                return restaurada.get();
            }
            ProjudiSession nova = autenticar(credencialId);
            cache.put(credencialId, nova);
            return nova;
        }
    }

    private Optional<ProjudiSession> restaurarSessaoPersistida(Long credencialId) {
        Optional<ProjudiSessionStore.SessaoPersistida> data = sessionStore.carregar(credencialId);
        if (data.isEmpty()) {
            return Optional.empty();
        }
        String cpf = credencialService.obter(credencialId).cpfUsuario();
        return Optional.of(criarSessaoComCookies(data.get(), cpf));
    }

    private ProjudiSession criarSessaoComCookies(ProjudiSessionStore.SessaoPersistida data, String cpf) {
        CookieManager cookieManager = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        URI base = URI.create(baseUrl);
        for (ProjudiSessionStore.CookieSnapshot snapshot : data.cookies()) {
            try {
                cookieManager.getCookieStore().add(base, snapshot.toHttpCookie());
            } catch (Exception e) {
                log.warn("Cookie ignorado ao restaurar sessão PROJUDI: {}", e.getMessage());
            }
        }
        HttpClient client = novoHttpClient(cookieManager);
        Instant autenticadoEm = data.autenticadoEm() != null ? data.autenticadoEm() : Instant.now();
        return new ProjudiSession(client, cookieManager, autenticadoEm, cpf, true);
    }

    private boolean sessaoValidaEmMemoria(ProjudiSession s) {
        return s != null
                && Duration.between(s.autenticadoEm(), Instant.now()).toMinutes() < ttlMin;
    }

    private void invalidar(Long credencialId) {
        cache.remove(credencialId);
        sessionStore.apagar(credencialId);
    }

    /** Descarta cookies persistidos — use antes/depois de validação ou protocolo para evitar rascunho sujo. */
    public void invalidarSessao(Long credencialId) {
        if (credencialId == null) {
            return;
        }
        invalidar(credencialId);
    }

    private ProjudiSession reautenticar(Long credencialId) {
        Object lock = locks.computeIfAbsent(credencialId, k -> new Object());
        synchronized (lock) {
            ProjudiSession nova = autenticar(credencialId);
            cache.put(credencialId, nova);
            return nova;
        }
    }

    private void registrarReaproveitamentoSeAplicavel(Long credencialId, ProjudiSession sessao) {
        if (sessao.carregadaDoDisco()) {
            log.info("PROJUDI sessão reaproveitada (persistida) (cpf={}).", mascararCpf(sessao.cpf()));
            cache.put(credencialId, sessao.comOrigemMemoria());
        }
    }

    // ------------------------------------------------------------------
    // Leitura autenticada (ÚNICO acesso público de rede)
    // ------------------------------------------------------------------

    /**
     * GET autenticado. Garante a sessão, executa o GET com o HttpClient da sessão
     * e decodifica o corpo como ISO-8859-1. Se a resposta cair no
     * formulário de login, invalida a sessão e reautentica UMA vez.
     */
    public RespostaProjudi getAutenticado(Long credencialId, String pathRelativoOuUrl) {
        ProjudiSession sessao = getSessao(credencialId);
        URI uri = resolver(pathRelativoOuUrl);

        RespostaProjudi resp = toResposta(getRaw(sessao.client(), uri));
        if (pareceNaoLogado(resp.body())) {
            log.info("PROJUDI sessão inválida/ausente -> novo login (cpf={}).", mascararCpf(sessao.cpf()));
            invalidar(credencialId);
            sessao = reautenticar(credencialId);
            resp = toResposta(getRaw(sessao.client(), uri));
            if (pareceNaoLogado(resp.body())) {
                throw new IllegalStateException(
                        "Acesso PROJUDI continuou na tela de login após reautenticação.");
            }
        } else {
            registrarReaproveitamentoSeAplicavel(credencialId, sessao);
        }
        log.info("GET autenticado PROJUDI ok (cpf={}, status={}, url={}).",
                mascararCpf(sessao.cpf()), resp.statusCode(), uri);
        return resp;
    }

    /**
     * GET autenticado lendo BYTES crus (para baixar PDF), sem decodificar como texto.
     * Mesma garantia de sessão/reautenticação do {@link #getAutenticado}.
     */
    public HttpResponse<byte[]> getAutenticadoBytes(Long credencialId, String pathRelativoOuUrl) {
        ProjudiSession sessao = getSessao(credencialId);
        URI uri = resolver(pathRelativoOuUrl);

        HttpResponse<byte[]> resp = getBytes(sessao.client(), uri);
        if (corpoPareceNaoLogado(resp.body())) {
            log.info("PROJUDI sessão inválida/ausente -> novo login (cpf={}).", mascararCpf(sessao.cpf()));
            invalidar(credencialId);
            sessao = reautenticar(credencialId);
            resp = getBytes(sessao.client(), uri);
            if (corpoPareceNaoLogado(resp.body())) {
                throw new IllegalStateException(
                        "Download PROJUDI continuou na tela de login após reautenticação.");
            }
        } else {
            registrarReaproveitamentoSeAplicavel(credencialId, sessao);
        }
        log.info("GET autenticado (bytes) PROJUDI ok (cpf={}, status={}, bytes={}, url={}).",
                mascararCpf(sessao.cpf()), resp.statusCode(),
                resp.body() == null ? 0 : resp.body().length, uri);
        return resp;
    }

    /**
     * GET autenticado AJAX (read-only): headers de XHR; corpo decodificado como ISO-8859-1.
     */
    public RespostaProjudi getAutenticadoAjax(Long credencialId, String caminhoRelativo) {
        ProjudiSession sessao = getSessao(credencialId);
        URI uri = resolver(caminhoRelativo);

        RespostaProjudi resp = toResposta(getAjaxRaw(sessao.client(), uri));
        if (pareceNaoLogado(resp.body())) {
            log.info("PROJUDI sessão inválida/ausente -> novo login (cpf={}).", mascararCpf(sessao.cpf()));
            invalidar(credencialId);
            sessao = reautenticar(credencialId);
            resp = toResposta(getAjaxRaw(sessao.client(), uri));
            if (pareceNaoLogado(resp.body())) {
                throw new IllegalStateException(
                        "Acesso AJAX PROJUDI continuou na tela de login após reautenticação.");
            }
        } else {
            registrarReaproveitamentoSeAplicavel(credencialId, sessao);
        }
        log.info("GET AJAX autenticado PROJUDI ok (cpf={}, status={}, url={}).",
                mascararCpf(sessao.cpf()), resp.statusCode(), uri);
        return resp;
    }

    /**
     * GET autenticado com {@code Referer} customizado (read-only).
     */
    public RespostaProjudi getAutenticadoComReferer(Long credencialId, String caminhoRelativo, String referer) {
        ProjudiSession sessao = getSessao(credencialId);
        URI uri = resolver(caminhoRelativo);

        RespostaProjudi resp = toResposta(getRawComReferer(sessao.client(), uri, referer));
        if (pareceNaoLogado(resp.body())) {
            log.info("PROJUDI sessão inválida/ausente -> novo login (cpf={}).", mascararCpf(sessao.cpf()));
            invalidar(credencialId);
            sessao = reautenticar(credencialId);
            resp = toResposta(getRawComReferer(sessao.client(), uri, referer));
            if (pareceNaoLogado(resp.body())) {
                throw new IllegalStateException(
                        "Acesso PROJUDI continuou na tela de login após reautenticação.");
            }
        } else {
            registrarReaproveitamentoSeAplicavel(credencialId, sessao);
        }
        log.info("GET autenticado PROJUDI ok (cpf={}, status={}, url={}).",
                mascararCpf(sessao.cpf()), resp.statusCode(), uri);
        return resp;
    }

    /**
     * GET autenticado AJAX com {@code Referer} customizado (read-only).
     */
    public RespostaProjudi getAutenticadoAjaxComReferer(Long credencialId, String caminhoRelativo, String referer) {
        ProjudiSession sessao = getSessao(credencialId);
        URI uri = resolver(caminhoRelativo);

        RespostaProjudi resp = toResposta(getAjaxRawComReferer(sessao.client(), uri, referer));
        if (pareceNaoLogado(resp.body())) {
            log.info("PROJUDI sessão inválida/ausente -> novo login (cpf={}).", mascararCpf(sessao.cpf()));
            invalidar(credencialId);
            sessao = reautenticar(credencialId);
            resp = toResposta(getAjaxRawComReferer(sessao.client(), uri, referer));
            if (pareceNaoLogado(resp.body())) {
                throw new IllegalStateException(
                        "Acesso AJAX PROJUDI continuou na tela de login após reautenticação.");
            }
        } else {
            registrarReaproveitamentoSeAplicavel(credencialId, sessao);
        }
        log.info("GET AJAX autenticado PROJUDI ok (cpf={}, status={}, url={}).",
                mascararCpf(sessao.cpf()), resp.statusCode(), uri);
        return resp;
    }

    /**
     * POST de escrita gateado para peticionamento ({@value #INSERCAO_ARQUIVO_PATH} /
     * Peticionamento). Não segue redirect automaticamente — o caller lê {@code Location}.
     */
    public HttpResponse<String> postPeticionamento(
            Long credencialId,
            String path,
            String query,
            String corpoFormUrlEncoded,
            Charset charset,
            String referer) {
        if (!PETICIONAMENTO_PATHS.contains(path)) {
            throw new IllegalArgumentException(
                    "POST de escrita PROJUDI permitido apenas para peticionamento. Path recusado: " + path);
        }
        ProjudiSession sessao = getSessao(credencialId);
        String caminho = path;
        if (query != null && !query.isBlank()) {
            caminho = path + "?" + query.trim();
        }
        URI uri = resolver(caminho);
        boolean ajax = query != null && query.contains("AJAX=ajax");

        String contentType = "application/x-www-form-urlencoded";
        if (INSERCAO_ARQUIVO_PATH.equals(path)) {
            contentType += "; charset=UTF-8";
        }

        HttpClient clientSemRedirect = HttpClient.newBuilder()
                .cookieHandler(sessao.cookieManager())
                .connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NEVER)
                .version(HttpClient.Version.HTTP_1_1)
                .build();

        HttpRequest.Builder reqBuilder = HttpRequest.newBuilder(uri)
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", contentType)
                .header("Origin", ORIGIN)
                .header("Referer", referer)
                .header("User-Agent", USER_AGENT)
                .POST(HttpRequest.BodyPublishers.ofString(corpoFormUrlEncoded, charset));

        if (ajax) {
            reqBuilder.header("X-Requested-With", "XMLHttpRequest")
                    .header("Accept", "*/*");
        } else {
            reqBuilder.header("Accept", "text/html,application/xhtml+xml,application/json,*/*;q=0.8");
        }

        HttpResponse<String> resp = enviar(clientSemRedirect, reqBuilder.build());
        if (resp.statusCode() >= 400) {
            log.warn(
                    "POST peticionamento PROJUDI resposta erro (cpf={}, path={}, status={}, corpo={}).",
                    mascararCpf(sessao.cpf()),
                    path,
                    resp.statusCode(),
                    truncar(resp.body(), 500));
        }
        log.info("POST peticionamento PROJUDI (cpf={}, path={}, status={}, location={}).",
                mascararCpf(sessao.cpf()), path, resp.statusCode(),
                resp.headers().firstValue("Location").orElse(""));
        return resp;
    }

    /**
     * Consulta de processo (SOMENTE LEITURA): POST de busca para {@value #BUSCA_PROCESSO_PATH}.
     *
     * <p><b>Barreira anti-ciência:</b> este é o único POST de consulta permitido. O POST é
     * gateado por {@link #postBuscaProcessoRaw}, que recusa qualquer path diferente de
     * {@value #BUSCA_PROCESSO_PATH} com {@link IllegalArgumentException}.</p>
     *
     * <p>Validação lazy da sessão: usa a própria consulta como teste (sem request extra).
     * Se vier a tela de login, reautentica e refaz a busca na mesma sessão nova.</p>
     */
    public RespostaProjudi buscarProcessoConsulta(Long credencialId, String numeroProcesso) {
        ProjudiSession sessao = getSessao(credencialId);
        String corpo = montarCorpoBuscaProcesso(numeroProcesso);
        // (corpo já inclui QuantidadeRegistrosPagina alto p/ trazer TODAS as movimentações)
        RespostaProjudi resp = toResposta(postBuscaProcessoRaw(sessao.client(), BUSCA_PROCESSO_PATH, corpo));
        if (pareceNaoLogado(resp.body())) {
            log.info("PROJUDI sessão inválida/ausente -> novo login (cpf={}).", mascararCpf(sessao.cpf()));
            invalidar(credencialId);
            sessao = reautenticar(credencialId);
            resp = toResposta(postBuscaProcessoRaw(sessao.client(), BUSCA_PROCESSO_PATH, corpo));
            if (pareceNaoLogado(resp.body())) {
                throw new IllegalStateException(
                        "Consulta PROJUDI continuou na tela de login após reautenticação.");
            }
        } else {
            registrarReaproveitamentoSeAplicavel(credencialId, sessao);
        }
        log.info("Consulta de processo PROJUDI (cpf={}, status={}).",
                mascararCpf(sessao.cpf()), resp.statusCode());
        return resp;
    }

    /**
     * Detecta resposta de sessão inválida/expirada (página ou redirect de LogOn).
     * Usado na consulta read-only como teste lazy — sem request adicional.
     */
    static boolean pareceNaoLogado(String body) {
        if (body == null || body.isBlank()) {
            return false;
        }
        String lower = body.toLowerCase(Locale.ROOT);
        if (body.contains("id=\"formLogin\"") || body.contains("id='formLogin'")) {
            return true;
        }
        if (lower.contains("formlogin") && lower.contains("name=\"usuario\"") && lower.contains("name=\"senha\"")) {
            return true;
        }
        if (lower.contains("paginaatual=7") && lower.contains("logon") && lower.contains("type=\"password\"")) {
            return true;
        }
        if (lower.contains("action=\"logon\"") || lower.contains("action='logon'")) {
            return true;
        }
        return lower.contains("/logon") && lower.contains("type=\"password\"");
    }

    // ------------------------------------------------------------------
    // Login (POST interno apenas para LogOn)
    // ------------------------------------------------------------------

    private ProjudiSession autenticar(Long credencialId) {
        CookieManager cookieManager = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        HttpClient client = novoHttpClient(cookieManager);

        // a. cookies iniciais (JSESSIONID, WIDPROP)
        getRaw(client, URI.create(baseUrl));

        // b. credenciais
        String cpf = credencialService.obter(credencialId).cpfUsuario();
        String senha = credencialService.obterSenha(credencialId);

        // c. marca o instante ANTES do POST (anti-stale do token)
        Instant inicioLogin = Instant.now();
        log.info("Iniciando login PROJUDI (cpf={}).", mascararCpf(cpf));

        // d. Passo 1 — login
        String corpoLogin = "PaginaAtual=7"
                + "&Usuario=" + enc(cpf)
                + "&Senha=" + enc(senha)
                + "&AJAX=true";
        HttpResponse<String> respLogin = postLogOn(client, corpoLogin);
        // TEMPORÁRIO - diagnóstico login
        log.info("[PROJUDI login-raw] status={} body={}",
                respLogin.statusCode(), truncar(respLogin.body(), 3000));
        JsonNode login = parseJson(respLogin.body());
        log.info("Resposta login PROJUDI (cpf={}, status={}).",
                mascararCpf(cpf), respLogin.statusCode());

        // e. confirmações manuais bloqueiam o fluxo automatizado
        if (login.path("requerConfirmacaoEmail").asBoolean(false)
                || login.path("requerConfirmacaoDataNascimento").asBoolean(false)) {
            throw new BusinessRuleException(
                    "Conta exige confirmação manual de e-mail/data de nascimento no PROJUDI. "
                            + "Faça um login manual uma vez para liberar.");
        }

        // f. fluxo com OTP
        if (login.path("requerOtp").asBoolean(false)) {
            Optional<String> token = tokenReader.aguardarToken(inicioLogin, OTP_TIMEOUT);
            if (token.isEmpty()) {
                throw new IllegalStateException("Token OTP não recebido no prazo.");
            }
            String corpoOtp = "PaginaAtual=7"
                    + "&Usuario=" + enc(cpf)
                    + "&Senha=" + enc(senha)
                    + "&AJAX=true"
                    + "&acaoOtp=validar"
                    + "&codigoOtp=" + enc(token.get());
            HttpResponse<String> respOtp = postLogOn(client, corpoOtp);
            JsonNode otp = parseJson(respOtp.body());
            log.info("Resposta validação OTP PROJUDI (cpf={}, status={}).",
                    mascararCpf(cpf), respOtp.statusCode());
            if (otp.path("sucesso").asBoolean(false) && temTexto(otp.path("urlRedirect").asText(null))) {
                concluirRedirect(client, otp.path("urlRedirect").asText(), cpf);
                return finalizarAutenticacao(credencialId, client, cookieManager, cpf);
            }
            throw new IllegalStateException("Falha na validação do OTP.");
        }

        // g. fluxo sem OTP
        if (login.path("sucesso").asBoolean(false) && temTexto(login.path("urlRedirect").asText(null))) {
            concluirRedirect(client, login.path("urlRedirect").asText(), cpf);
            return finalizarAutenticacao(credencialId, client, cookieManager, cpf);
        }

        // h.
        // TEMPORÁRIO - diagnóstico login
        throw new IllegalStateException("Resposta inesperada do servidor no login. Corpo (1000): "
                + truncar(respLogin.body(), 1000));
    }

    private ProjudiSession finalizarAutenticacao(
            Long credencialId, HttpClient client, CookieManager cookieManager, String cpf) {
        ProjudiSession sessao = new ProjudiSession(client, cookieManager, Instant.now(), cpf, false);
        sessionStore.salvar(credencialId, sessao);
        return sessao;
    }

    private void concluirRedirect(HttpClient client, String urlRedirect, String cpf) {
        URI destino = resolver(urlRedirect);
        log.info("Login PROJUDI confirmado, seguindo redirect (cpf={}, urlRedirect={}).",
                mascararCpf(cpf), destino);
        getRaw(client, destino);
    }

    private String montarCorpoBuscaProcesso(String numeroProcesso) {
        // QuantidadeRegistrosPagina controla quantas movimentações a consulta devolve. Vazio = default
        // do PROJUDI (~100, só as mais recentes), o que deixava processos grandes parando de arquivar
        // movimentações novas/antigas além da janela. Enviamos um valor alto para listar TODAS.
        return "PaginaAtual=2"
                + "&PaginaAnterior=2"
                + "&TipoConsultaProcesso=null"
                + "&BuscaPublica=null"
                + "&ServletRedirect=null"
                + "&QuantidadeRegistrosPagina=" + quantidadeRegistrosPagina
                + "&ProcessoNumero=" + enc(numeroProcesso)
                + "&Inquerito="
                + "&NomeParte="
                + "&PesquisarNomeExato=false"
                + "&CpfCnpjParte="
                + "&ProcessoStatus="
                + "&Id_ProcessoStatus=null"
                + "&ProcessoStatusCodigo=null"
                + "&ProcessoTipo="
                + "&Id_ProcessoTipo="
                + "&ProcessoTipoCodigo="
                + "&Serventia="
                + "&Id_Serventia="
                + "&imgSubmeter=Buscar";
    }

    // ------------------------------------------------------------------
    // HTTP helpers
    // ------------------------------------------------------------------

    private HttpClient novoHttpClient(CookieManager cookieManager) {
        return HttpClient.newBuilder()
                .cookieHandler(cookieManager)
                .connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NORMAL)
                .version(HttpClient.Version.HTTP_1_1)
                .build();
    }

    private HttpResponse<byte[]> getRaw(HttpClient client, URI uri) {
        HttpRequest req = HttpRequest.newBuilder(uri)
                .GET()
                .timeout(REQUEST_TIMEOUT)
                .header("User-Agent", USER_AGENT)
                .header("Accept", "text/html,application/xhtml+xml,application/json,*/*;q=0.8")
                .build();
        return enviarBytes(client, req);
    }

    /** GET AJAX: headers de XHR + Accept JSON; corpo lido como bytes crus. */
    private HttpResponse<byte[]> getAjaxRaw(HttpClient client, URI uri) {
        return getAjaxRawComReferer(client, uri, null);
    }

    private HttpResponse<byte[]> getRawComReferer(HttpClient client, URI uri, String referer) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .GET()
                .timeout(REQUEST_TIMEOUT)
                .header("User-Agent", USER_AGENT)
                .header("Accept", "text/html,application/xhtml+xml,application/json,*/*;q=0.8");
        if (referer != null && !referer.isBlank()) {
            builder.header("Referer", referer);
        }
        return enviarBytes(client, builder.build());
    }

    private HttpResponse<byte[]> getAjaxRawComReferer(HttpClient client, URI uri, String referer) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .GET()
                .timeout(REQUEST_TIMEOUT)
                .header("User-Agent", USER_AGENT)
                .header("X-Requested-With", "XMLHttpRequest")
                .header("Accept", "application/json, text/javascript, */*");
        if (referer != null && !referer.isBlank()) {
            builder.header("Referer", referer);
        }
        return enviarBytes(client, builder.build());
    }

    private HttpResponse<byte[]> getBytes(HttpClient client, URI uri) {
        HttpRequest req = HttpRequest.newBuilder(uri)
                .GET()
                .timeout(REQUEST_TIMEOUT)
                .header("User-Agent", USER_AGENT)
                .header("Accept", "text/html,application/xhtml+xml,application/json,*/*;q=0.8")
                .build();
        return enviarBytes(client, req);
    }

    private HttpResponse<byte[]> postBuscaProcessoRaw(HttpClient client, String path, String corpoFormUrlEncoded) {
        if (!BUSCA_PROCESSO_PATH.equals(path)) {
            throw new IllegalArgumentException(
                    "POST de consulta PROJUDI permitido apenas para '" + BUSCA_PROCESSO_PATH
                            + "' (barreira anti-ciência). Path recusado: " + path);
        }
        HttpRequest req = HttpRequest.newBuilder(resolver(path))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/x-www-form-urlencoded; charset=ISO-8859-1")
                .header("Accept", "text/html,application/xhtml+xml,application/json,*/*;q=0.8")
                .header("Origin", ORIGIN)
                .header("Referer", BUSCA_PROCESSO_REFERER)
                .header("User-Agent", USER_AGENT)
                .POST(HttpRequest.BodyPublishers.ofString(corpoFormUrlEncoded, StandardCharsets.ISO_8859_1))
                .build();
        return enviarBytes(client, req);
    }

    private HttpResponse<String> postLogOn(HttpClient client, String corpoFormUrlEncoded) {
        HttpRequest req = HttpRequest.newBuilder(resolver(LOGON_PATH))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
                .header("Accept", "application/json, text/javascript, */*; q=0.01")
                .header("X-Requested-With", "XMLHttpRequest")
                .header("Origin", ORIGIN)
                .header("Referer", REFERER)
                .header("User-Agent", USER_AGENT)
                .POST(HttpRequest.BodyPublishers.ofString(corpoFormUrlEncoded, StandardCharsets.UTF_8))
                .build();
        return enviar(client, req);
    }

    /** Envia lendo o corpo como ISO-8859-1 (charset declarado pelo PROJUDI), independente do status. */
    private HttpResponse<String> enviar(HttpClient client, HttpRequest req) {
        return enviarComRetry(client, req, HttpResponse.BodyHandlers.ofString(StandardCharsets.ISO_8859_1));
    }

    /** Envia lendo o corpo como bytes crus (sem decodificar). */
    private HttpResponse<byte[]> enviarBytes(HttpClient client, HttpRequest req) {
        return enviarComRetry(client, req, HttpResponse.BodyHandlers.ofByteArray());
    }

    private <T> HttpResponse<T> enviarComRetry(HttpClient client, HttpRequest req, HttpResponse.BodyHandler<T> handler) {
        IOException ultima = null;
        for (int tentativa = 1; tentativa <= MAX_TENTATIVAS_HTTP; tentativa++) {
            try {
                return client.send(req, handler);
            } catch (IOException e) {
                ultima = e;
                if (tentativa < MAX_TENTATIVAS_HTTP && comunicacaoRecuperavel(e)) {
                    log.warn(
                            "PROJUDI comunicação falhou (tentativa {}/{}): {} — {}",
                            tentativa,
                            MAX_TENTATIVAS_HTTP,
                            req.uri(),
                            e.getMessage());
                    pausaRetry(tentativa);
                    continue;
                }
                throw new IllegalStateException("Falha de comunicação com o PROJUDI: " + e.getMessage(), e);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Comunicação com o PROJUDI interrompida.", e);
            }
        }
        throw new IllegalStateException("Falha de comunicação com o PROJUDI: " + ultima.getMessage(), ultima);
    }

    private static boolean comunicacaoRecuperavel(IOException e) {
        String msg = e.getMessage() == null ? "" : e.getMessage().toLowerCase(Locale.ROOT);
        return msg.contains("header parser received no bytes")
                || msg.contains("connection reset")
                || msg.contains("broken pipe")
                || msg.contains("eof reached")
                || msg.contains("timed out");
    }

    private static void pausaRetry(int tentativa) {
        try {
            Thread.sleep(500L * tentativa);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    private JsonNode parseJson(String corpo) {
        try {
            return objectMapper.readTree(corpo == null ? "" : corpo);
        } catch (Exception e) {
            // Sem JSON normalmente significa que o servidor devolveu HTML (headers ausentes
            // ou sessão inválida). Não logar o corpo (pode conter dados sensíveis).
            throw new IllegalStateException(
                    "Resposta do PROJUDI não é JSON válido (possível HTML de login).", e);
        }
    }

    private URI resolver(String pathOuUrl) {
        if (pathOuUrl == null || pathOuUrl.isBlank()) {
            throw new BusinessRuleException("URL/caminho de acesso é obrigatório.");
        }
        String alvo = pathOuUrl.trim();
        if (alvo.startsWith("http://") || alvo.startsWith("https://")) {
            return URI.create(alvo);
        }
        // Caminhos relativos: remove "/" inicial para resolver contra a base com barra final.
        if (alvo.startsWith("/")) {
            alvo = alvo.substring(1);
        }
        return URI.create(baseUrl).resolve(alvo);
    }

    /**
     * Detecta a tela de login num corpo binário (ex.: sessão expirou e o servidor
     * devolveu HTML em vez do PDF). Inspeciona só o início, decodificado como ISO-8859-1.
     */
    private static boolean corpoPareceNaoLogado(byte[] body) {
        if (body == null || body.length == 0) {
            return false;
        }
        int n = Math.min(body.length, 8192);
        String inicio = new String(body, 0, n, StandardCharsets.ISO_8859_1);
        return pareceNaoLogado(inicio);
    }

    private static String enc(String valor) {
        return URLEncoder.encode(valor == null ? "" : valor, StandardCharsets.UTF_8);
    }

    private static boolean temTexto(String s) {
        return s != null && !s.isBlank();
    }

    // TEMPORÁRIO - diagnóstico login
    private static String truncar(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max) + "...[truncado]";
    }

    private static String mascararCpf(String cpf) {
        if (cpf == null) {
            return "***";
        }
        String d = cpf.replaceAll("\\D", "");
        if (d.length() < 5) {
            return "***";
        }
        return d.substring(0, 3) + ".***.**-" + d.substring(d.length() - 2);
    }

    /** Resposta textual decodificada (substituto de {@link HttpResponse}{@code <String>}). */
    public record RespostaProjudi(int statusCode, String body) {
    }

    private static RespostaProjudi toResposta(HttpResponse<byte[]> raw) {
        byte[] bytes = raw.body();
        return new RespostaProjudi(raw.statusCode(), decodificar(bytes));
    }

    /**
     * Decodifica bytes do PROJUDI como ISO-8859-1 (charset real dos dados textuais do tribunal).
     */
    static String decodificar(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return "";
        }
        return new String(bytes, StandardCharsets.ISO_8859_1);
    }

    /**
     * Sessão autenticada de uma credencial: HttpClient isolado (com CookieManager
     * próprio), instante de autenticação e CPF (para log mascarado).
     */
    public record ProjudiSession(
            HttpClient client,
            CookieManager cookieManager,
            Instant autenticadoEm,
            String cpf,
            boolean carregadaDoDisco) {

        ProjudiSession comOrigemMemoria() {
            return new ProjudiSession(client, cookieManager, autenticadoEm, cpf, false);
        }
    }
}
