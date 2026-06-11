package br.com.vilareal.totp.domain;

/**
 * Mecanismo de segundo fator exigido pelo tribunal no login do robô.
 */
public enum TipoSegundoFator {
    /** Código TOTP gerado localmente (Google Authenticator / RFC 6238). */
    TOTP_APP,
    /** Código recebido por e-mail (ex.: PROJUDI TJGO). */
    EMAIL,
    /** Tribunal sem 2FA no fluxo automatizado. */
    NENHUM
}
