package br.com.vilareal.pje.application;

/**
 * Estado observável da sessão no driver de browser (stub ou implementação futura).
 */
public enum PjeBrowserSessionState {
    NAO_ABERTO,
    TELA_LOGIN,
    TELA_OTP,
    AUTENTICADO,
    ERRO
}
