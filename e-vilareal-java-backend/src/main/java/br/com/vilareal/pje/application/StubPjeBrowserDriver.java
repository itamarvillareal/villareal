package br.com.vilareal.pje.application;

import br.com.vilareal.pje.domain.PjeGrau;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Implementação stub — simula o fluxo login → OTP → autenticado quando
 * {@code app.pje.browser.enabled=false} (padrão em CI e dev sem Chromium).
 */
@Component
@ConditionalOnProperty(name = "app.pje.browser.enabled", havingValue = "false", matchIfMissing = true)
public class StubPjeBrowserDriver implements PjeBrowserDriver {

    private static final Logger log = LoggerFactory.getLogger(StubPjeBrowserDriver.class);

    private PjeBrowserSessionState estado = PjeBrowserSessionState.NAO_ABERTO;
    private String ultimoOtp;

    @Override
    public void abrir(PjeGrau grau, String url) {
        log.debug("Stub PJe: abrir {} em {}", grau, url);
        estado = PjeBrowserSessionState.TELA_LOGIN;
    }

    @Override
    public void preencherCredenciais(String login, String senha) {
        log.debug("Stub PJe: credenciais preenchidas para login={}", login);
    }

    @Override
    public void submeterLogin() {
        estado = PjeBrowserSessionState.TELA_OTP;
    }

    @Override
    public boolean telaOtpVisivel() {
        return estado == PjeBrowserSessionState.TELA_OTP;
    }

    @Override
    public void preencherCodigoOtp(String codigo) {
        this.ultimoOtp = codigo;
        log.debug("Stub PJe: OTP preenchido (mascarado)");
    }

    @Override
    public void submeterOtp() {
        if (ultimoOtp != null && ultimoOtp.length() == 6) {
            estado = PjeBrowserSessionState.AUTENTICADO;
        } else {
            estado = PjeBrowserSessionState.ERRO;
        }
    }

    @Override
    public PjeBrowserSessionState estadoAtual() {
        return estado;
    }

    @Override
    public void fechar() {
        estado = PjeBrowserSessionState.NAO_ABERTO;
        ultimoOtp = null;
    }

    /** Exposto para testes do stub. */
    String ultimoOtpPreenchido() {
        return ultimoOtp;
    }
}
