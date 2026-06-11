package br.com.vilareal.totp.domain;

/**
 * Tribunais/sistemas suportados pelo robô de login automatizado.
 * Cada valor declara o tipo de 2FA esperado no fluxo de autenticação.
 */
public enum TribunalIntegracao {
    /** PJe TRT18 — 2FA por app autenticador (TOTP) desde 03/11/2025. */
    PJE_TRT18(TipoSegundoFator.TOTP_APP),
    PJE_TJPR(TipoSegundoFator.TOTP_APP);

    private final TipoSegundoFator tipoSegundoFator;

    TribunalIntegracao(TipoSegundoFator tipoSegundoFator) {
        this.tipoSegundoFator = tipoSegundoFator;
    }

    public TipoSegundoFator tipoSegundoFator() {
        return tipoSegundoFator;
    }

    public static TribunalIntegracao fromCodigo(String codigo) {
        if (codigo == null || codigo.isBlank()) {
            throw new IllegalArgumentException("Tribunal é obrigatório.");
        }
        String norm = codigo.trim().toUpperCase();
        for (TribunalIntegracao t : values()) {
            if (t.name().equals(norm)) {
                return t;
            }
        }
        throw new IllegalArgumentException("Tribunal desconhecido: " + codigo);
    }
}
