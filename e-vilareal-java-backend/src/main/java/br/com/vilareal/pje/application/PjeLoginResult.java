package br.com.vilareal.pje.application;

import br.com.vilareal.pje.domain.PjeGrau;
import br.com.vilareal.totp.domain.TribunalIntegracao;

public record PjeLoginResult(
        TribunalIntegracao tribunal,
        PjeGrau grau,
        String login,
        boolean sucesso,
        PjeBrowserSessionState estadoFinal,
        String mensagem) {

    public static PjeLoginResult sucesso(
            TribunalIntegracao tribunal, PjeGrau grau, String login, PjeBrowserSessionState estado) {
        return new PjeLoginResult(tribunal, grau, login, true, estado, "Sessão autenticada.");
    }

    public static PjeLoginResult falha(
            TribunalIntegracao tribunal,
            PjeGrau grau,
            String login,
            PjeBrowserSessionState estado,
            String mensagem) {
        return new PjeLoginResult(tribunal, grau, login, false, estado, mensagem);
    }
}
