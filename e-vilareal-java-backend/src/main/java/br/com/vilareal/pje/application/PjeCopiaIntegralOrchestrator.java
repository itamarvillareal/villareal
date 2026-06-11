package br.com.vilareal.pje.application;

import br.com.vilareal.pje.config.PjeTrt18Properties;
import br.com.vilareal.pje.domain.PjeGrau;
import br.com.vilareal.pje.infrastructure.browser.PlaywrightPjeBrowserDriver;
import br.com.vilareal.pje.infrastructure.browser.PjeTrt18CnjUtil;
import br.com.vilareal.robot.RobotAutoFreio;
import br.com.vilareal.robot.RobotGlobalLock;
import br.com.vilareal.robot.RobotLoteContext;
import br.com.vilareal.totp.application.CredencialTotpService;
import br.com.vilareal.totp.application.SegundoFatorCodigoResolver;
import br.com.vilareal.totp.domain.TribunalIntegracao;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Optional;

/**
 * Login PJe + busca CNJ + cópia integral (blob) + upload Drive.
 * Reusa salvaguardas {@link RobotGlobalLock} / {@link RobotAutoFreio} / {@link RobotLoteContext}.
 */
@Service
public class PjeCopiaIntegralOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(PjeCopiaIntegralOrchestrator.class);

    private static final TribunalIntegracao TRIBUNAL = TribunalIntegracao.PJE_TRT18;

    private final ObjectProvider<PlaywrightPjeBrowserDriver> playwrightDriver;
    private final PjeTrt18Properties properties;
    private final SegundoFatorCodigoResolver segundoFatorCodigoResolver;
    private final CredencialTotpService credencialTotpService;
    private final PjeDriveArquivamentoService driveArquivamentoService;
    private final RobotGlobalLock globalLock;
    private final RobotAutoFreio autoFreio;
    private final RobotLoteContext loteContext;

    public PjeCopiaIntegralOrchestrator(
            ObjectProvider<PlaywrightPjeBrowserDriver> playwrightDriver,
            PjeTrt18Properties properties,
            SegundoFatorCodigoResolver segundoFatorCodigoResolver,
            CredencialTotpService credencialTotpService,
            PjeDriveArquivamentoService driveArquivamentoService,
            RobotGlobalLock globalLock,
            RobotAutoFreio autoFreio,
            RobotLoteContext loteContext) {
        this.playwrightDriver = playwrightDriver;
        this.properties = properties;
        this.segundoFatorCodigoResolver = segundoFatorCodigoResolver;
        this.credencialTotpService = credencialTotpService;
        this.driveArquivamentoService = driveArquivamentoService;
        this.globalLock = globalLock;
        this.autoFreio = autoFreio;
        this.loteContext = loteContext;
    }

    public Optional<PjeCopiaIntegralResult> executar(
            PjeGrau grau, String login, String senha, String numeroCnj) {
        autoFreio.configurarLimite(properties.getAutoFreioLimiteErros());

        if (autoFreio.estaFreiado()) {
            return Optional.of(PjeCopiaIntegralResult.falha(
                    grau, numeroCnj, "robô PJe TRT18 em auto-freio; aguarde reset."));
        }
        if (!loteContext.reservarLogin(login)) {
            return Optional.of(PjeCopiaIntegralResult.falha(
                    grau, numeroCnj, "lote já reservado para outro login."));
        }
        try {
            Optional<PjeCopiaIntegralResult> resultado = globalLock.tryExecutarComRetorno(
                    "pje/trt18/copia-integral", () -> executarInterno(grau, login, senha, numeroCnj));
            if (resultado.isEmpty()) {
                return Optional.of(PjeCopiaIntegralResult.falha(
                        grau, numeroCnj, "robô global ocupado; tente novamente em alguns minutos."));
            }
            return resultado;
        } finally {
            loteContext.encerrarLote();
        }
    }

    private PjeCopiaIntegralResult executarInterno(
            PjeGrau grau, String login, String senha, String numeroCnj) {
        PlaywrightPjeBrowserDriver driver = playwrightDriver.getIfAvailable();
        if (driver == null) {
            return PjeCopiaIntegralResult.falha(
                    grau, numeroCnj, "Playwright desabilitado (app.pje.browser.enabled=false).");
        }
        if (!StringUtils.hasText(login) || !StringUtils.hasText(numeroCnj)) {
            return registrarFalha(grau, numeroCnj, "login e CNJ são obrigatórios.");
        }

        String loginNorm = login.trim();
        String cnj = numeroCnj.trim();
        Optional<String> senhaResolvida = resolverSenha(loginNorm, senha);
        if (senhaResolvida.isEmpty()) {
            return registrarFalha(grau, cnj, PjeLoginOrchestrator.mensagemSemSenha(loginNorm));
        }

        try {
            garantirLogin(driver, grau, loginNorm, senhaResolvida.get());
            driver.buscarProcessoPorCnj(cnj);
            byte[] pdf = driver.baixarCopiaIntegralPdf(cnj);

            var processo = driveArquivamentoService.resolverProcessoPorCnj(cnj);
            String nomeArquivo = PjeTrt18CnjUtil.nomeArquivoPdf(cnj);
            var upload = driveArquivamentoService.enviarCopiaIntegral(processo, cnj, pdf, nomeArquivo);

            autoFreio.registrarSucesso();
            return PjeCopiaIntegralResult.sucesso(
                    grau, cnj, upload.driveFileId(), upload.nomeArquivo(), upload.pastaMovimentacoesId());
        } catch (RuntimeException e) {
            log.warn("PJe cópia integral falhou (cnj={}): {}", cnj, e.getMessage());
            return registrarFalha(grau, cnj, e.getMessage());
        } finally {
            driver.fechar();
        }
    }

    private void garantirLogin(PlaywrightPjeBrowserDriver driver, PjeGrau grau, String login, String senha) {
        if (!driver.tentarRestaurarSessao(grau, login)) {
            driver.abrir(grau, properties.urlParaGrau(grau));
            driver.preencherCredenciais(login, senha);
            driver.submeterLogin();
            if (driver.telaOtpVisivel()) {
                log.info("PJe TRT18: solicitando código TOTP pós-credencial (cópia integral)");
                String codigo = segundoFatorCodigoResolver
                        .obterCodigoTotpSeAplicavel(TRIBUNAL, login)
                        .orElseThrow(() -> new IllegalStateException(
                                PjeLoginOrchestrator.mensagemSemCredencialTotp(login)));
                driver.preencherCodigoOtp(codigo);
                driver.submeterOtp();
            }
        }

        if (driver.estadoAtual() != PjeBrowserSessionState.AUTENTICADO) {
            throw new IllegalStateException(
                    "Login PJe não concluiu (estado=" + driver.estadoAtual() + ").");
        }
    }

    private Optional<String> resolverSenha(String loginNorm, String senhaInformada) {
        if (StringUtils.hasText(senhaInformada)) {
            return Optional.of(senhaInformada.trim());
        }
        return credencialTotpService.obterSenhaPrimeiroFator(TRIBUNAL, loginNorm);
    }

    private PjeCopiaIntegralResult registrarFalha(PjeGrau grau, String cnj, String mensagem) {
        autoFreio.registrarFalha();
        return PjeCopiaIntegralResult.falha(grau, cnj, mensagem);
    }
}
