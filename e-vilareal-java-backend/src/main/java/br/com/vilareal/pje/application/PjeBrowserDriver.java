package br.com.vilareal.pje.application;

import br.com.vilareal.pje.domain.PjeGrau;

/**
 * Abstração da automação de browser no PJe. O orquestrador depende desta interface —
 * a implementação concreta (Playwright, Selenium, etc.) fica para uma fase posterior.
 */
public interface PjeBrowserDriver {

    /** Abre a URL do grau informado. */
    void abrir(PjeGrau grau, String url);

    /** Preenche usuário e senha na tela de login. */
    void preencherCredenciais(String login, String senha);

    /** Submete o formulário de login (avança para OTP ou sessão). */
    void submeterLogin();

    /** Indica se a tela de código OTP (6 dígitos) está visível. */
    boolean telaOtpVisivel();

    /** Preenche o código TOTP de 6 dígitos. */
    void preencherCodigoOtp(String codigo);

    /** Submete o OTP. */
    void submeterOtp();

    /** Estado atual da sessão no browser. */
    PjeBrowserSessionState estadoAtual();

    /** Fecha o browser/sessão. */
    void fechar();
}
