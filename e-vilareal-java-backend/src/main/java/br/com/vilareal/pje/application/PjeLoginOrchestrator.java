package br.com.vilareal.pje.application;

import br.com.vilareal.pje.config.PjeTrt18Properties;
import br.com.vilareal.pje.domain.PjeGrau;
import br.com.vilareal.robot.RobotAutoFreio;
import br.com.vilareal.robot.RobotGlobalLock;
import br.com.vilareal.robot.RobotLoteContext;
import br.com.vilareal.totp.application.CredencialTotpService;
import br.com.vilareal.totp.application.SegundoFatorCodigoResolver;
import br.com.vilareal.totp.domain.TribunalIntegracao;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Optional;

/**
 * Orquestra login automatizado no PJe TRT18 (usuário + senha + TOTP).
 * Isolado do fluxo Projudi; usa {@link PjeBrowserDriver} e {@link SegundoFatorCodigoResolver}.
 */
@Service
public class PjeLoginOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(PjeLoginOrchestrator.class);

    static final TribunalIntegracao TRIBUNAL = TribunalIntegracao.PJE_TRT18;

    private final PjeBrowserDriver browserDriver;
    private final PjeTrt18Properties properties;
    private final SegundoFatorCodigoResolver segundoFatorCodigoResolver;
    private final CredencialTotpService credencialTotpService;
    private final RobotGlobalLock globalLock;
    private final RobotAutoFreio autoFreio;
    private final RobotLoteContext loteContext;

    public PjeLoginOrchestrator(
            PjeBrowserDriver browserDriver,
            PjeTrt18Properties properties,
            SegundoFatorCodigoResolver segundoFatorCodigoResolver,
            CredencialTotpService credencialTotpService,
            RobotGlobalLock globalLock,
            RobotAutoFreio autoFreio,
            RobotLoteContext loteContext) {
        this.browserDriver = browserDriver;
        this.properties = properties;
        this.segundoFatorCodigoResolver = segundoFatorCodigoResolver;
        this.credencialTotpService = credencialTotpService;
        this.globalLock = globalLock;
        this.autoFreio = autoFreio;
        this.loteContext = loteContext;
    }

    /**
     * Executa login com salvaguardas (lock global, auto-freio, 1 login por lote).
     * {@code senha} opcional: se vazia, busca no cofre TOTP por (PJE_TRT18, login).
     */
    public Optional<PjeLoginResult> executarLogin(PjeGrau grau, String login, String senha) {
        autoFreio.configurarLimite(properties.getAutoFreioLimiteErros());

        if (autoFreio.estaFreiado()) {
            return Optional.of(falha(
                    grau,
                    login,
                    PjeBrowserSessionState.ERRO,
                    "robô PJe TRT18 em auto-freio após "
                            + autoFreio.errosConsecutivos()
                            + " erros consecutivos; aguarde reset manual ou sucesso em outro contexto."));
        }

        if (!loteContext.reservarLogin(login)) {
            String outro = loteContext.loginAtivo().orElse("?");
            return Optional.of(falha(
                    grau,
                    login,
                    PjeBrowserSessionState.ERRO,
                    "lote já reservado para outro login (" + outro + "); apenas 1 login por lote."));
        }

        try {
            Optional<PjeLoginResult> resultado =
                    globalLock.tryExecutarComRetorno("pje/trt18/login", () -> executarLoginInterno(grau, login, senha));
            if (resultado.isEmpty()) {
                return Optional.of(falha(
                        grau,
                        login,
                        PjeBrowserSessionState.ERRO,
                        "robô global ocupado; tente novamente em alguns minutos."));
            }
            return resultado;
        } finally {
            loteContext.encerrarLote();
        }
    }

    private PjeLoginResult executarLoginInterno(PjeGrau grau, String login, String senhaInformada) {
        if (grau == null) {
            return registrarFalha(null, login, PjeBrowserSessionState.ERRO, "grau é obrigatório.");
        }
        if (!StringUtils.hasText(login)) {
            return registrarFalha(grau, login, PjeBrowserSessionState.ERRO, "login é obrigatório.");
        }

        String loginNorm = login.trim();
        Optional<String> senhaResolvida = resolverSenha(loginNorm, senhaInformada);
        if (senhaResolvida.isEmpty()) {
            return registrarFalha(grau, loginNorm, PjeBrowserSessionState.ERRO, mensagemSemSenha(loginNorm));
        }

        String url = properties.urlParaGrau(grau);

        try {
            browserDriver.abrir(grau, url);
            // Decifra/uso da senha só neste ponto — não logar nem persistir em artefatos.
            browserDriver.preencherCredenciais(loginNorm, senhaResolvida.get());
            browserDriver.submeterLogin();

            if (browserDriver.telaOtpVisivel()) {
                log.info("PJe TRT18: solicitando código TOTP pós-credencial (grau={})", grau);
                Optional<String> codigo =
                        segundoFatorCodigoResolver.obterCodigoTotpSeAplicavel(TRIBUNAL, loginNorm);
                if (codigo.isEmpty()) {
                    return registrarFalha(
                            grau,
                            loginNorm,
                            browserDriver.estadoAtual(),
                            mensagemSemCredencialTotp(loginNorm));
                }
                browserDriver.preencherCodigoOtp(codigo.get());
                browserDriver.submeterOtp();
            }

            PjeBrowserSessionState estado = browserDriver.estadoAtual();
            if (estado != PjeBrowserSessionState.AUTENTICADO) {
                return registrarFalha(
                        grau,
                        loginNorm,
                        estado,
                        "login não concluiu sessão autenticada (estado=" + estado + ").");
            }

            autoFreio.registrarSucesso();
            String modo = properties.isModoLeitura() ? "modo leitura ativo" : "modo completo";
            log.info("PJe TRT18 login OK: grau={} login={} ({})", grau, loginNorm, modo);
            return PjeLoginResult.sucesso(TRIBUNAL, grau, loginNorm, estado);
        } catch (RuntimeException e) {
            log.warn("Falha no login PJe TRT18 (grau={}, login={}): {}", grau, loginNorm, e.getMessage());
            return registrarFalha(grau, loginNorm, browserDriver.estadoAtual(), e.getMessage());
        } finally {
            browserDriver.fechar();
        }
    }

    Optional<String> resolverSenha(String loginNorm, String senhaInformada) {
        if (StringUtils.hasText(senhaInformada)) {
            return Optional.of(senhaInformada.trim());
        }
        return credencialTotpService.obterSenhaPrimeiroFator(TRIBUNAL, loginNorm);
    }

    static String mensagemSemSenha(String login) {
        return "Senha do PJE_TRT18 não informada e não cadastrada no cofre para o login "
                + login
                + ". Cadastre via PUT /api/admin/totp/credenciais/{id} com campo senha "
                + "(ou POST no cadastro), ou informe senha no corpo para teste manual.";
    }

    static String mensagemSemCredencialTotp(String login) {
        return "Cadastre o segredo TOTP do PJE_TRT18 para o login "
                + login
                + " via POST /api/admin/totp/credenciais "
                + "(tribunal=PJE_TRT18, login, otpauthUriOuSecret). "
                + "A conta deve usar 2FA por app autenticador (não gov.br).";
    }

    private PjeLoginResult registrarFalha(
            PjeGrau grau, String login, PjeBrowserSessionState estado, String mensagem) {
        autoFreio.registrarFalha();
        return falha(grau, login, estado, mensagem);
    }

    private static PjeLoginResult falha(
            PjeGrau grau, String login, PjeBrowserSessionState estado, String mensagem) {
        return PjeLoginResult.falha(TRIBUNAL, grau, login, estado, mensagem);
    }
}
