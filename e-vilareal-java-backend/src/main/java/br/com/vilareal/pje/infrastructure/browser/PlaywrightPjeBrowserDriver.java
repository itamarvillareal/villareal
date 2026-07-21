package br.com.vilareal.pje.infrastructure.browser;

import br.com.vilareal.pje.application.PjeBrowserDriver;
import br.com.vilareal.pje.application.PjeBrowserSessionState;
import br.com.vilareal.pje.application.PjeTrt18ProcessoAutomation;
import br.com.vilareal.pje.domain.PjeGrau;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Adaptador {@link PjeBrowserDriver} + {@link PjeTrt18ProcessoAutomation} sobre o motor Playwright.
 */
@Service
@ConditionalOnProperty(name = "app.pje.browser.enabled", havingValue = "true")
public class PlaywrightPjeBrowserDriver implements PjeBrowserDriver, PjeTrt18ProcessoAutomation {

    private final PjeTrt18PlaywrightEngine engine;

    public PlaywrightPjeBrowserDriver(PjeTrt18PlaywrightEngine engine) {
        this.engine = engine;
    }

    @Override
    public void abrir(PjeGrau grau, String url) {
        engine.abrir(grau, url);
    }

    @Override
    public void preencherCredenciais(String login, String senha) {
        engine.preencherCredenciais(login, senha);
    }

    @Override
    public void submeterLogin() {
        engine.submeterLogin();
    }

    @Override
    public boolean telaOtpVisivel() {
        return engine.telaOtpVisivel();
    }

    @Override
    public void preencherCodigoOtp(String codigo) {
        engine.preencherCodigoOtp(codigo);
    }

    @Override
    public void submeterOtp() {
        engine.submeterOtp();
    }

    @Override
    public PjeBrowserSessionState estadoAtual() {
        return engine.estadoAtual();
    }

    @Override
    public void fechar() {
        engine.fechar();
    }

    @Override
    public void buscarProcessoPorCnj(String numeroCnj) {
        engine.buscarProcessoPorCnj(numeroCnj);
    }

    @Override
    public byte[] baixarCopiaIntegralPdf(String numeroCnj) {
        return engine.baixarCopiaIntegralPdf(numeroCnj);
    }

    @Override
    public boolean playwrightAtivo() {
        return true;
    }

    /** Restaura storageState se existir (opcional, antes do login completo). */
    public boolean tentarRestaurarSessao(PjeGrau grau, String login) {
        return engine.tentarRestaurarSessao(grau, login);
    }

    public void registrarFalhaLoginSeAplicavel() {
        engine.registrarFalhaLoginSeAplicavel();
    }

    public String mensagemFalhaLogin() {
        return engine.mensagemFalhaLogin();
    }
}
