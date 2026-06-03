package br.com.vilareal.integracao.cora;

public class CoraHealthResult {

    private boolean enabled;
    private boolean mtlsOk;
    private boolean tokenOk;
    private boolean contaOk;

    public static CoraHealthResult disabled() {
        CoraHealthResult r = new CoraHealthResult();
        r.setEnabled(false);
        return r;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isMtlsOk() {
        return mtlsOk;
    }

    public void setMtlsOk(boolean mtlsOk) {
        this.mtlsOk = mtlsOk;
    }

    public boolean isTokenOk() {
        return tokenOk;
    }

    public void setTokenOk(boolean tokenOk) {
        this.tokenOk = tokenOk;
    }

    public boolean isContaOk() {
        return contaOk;
    }

    public void setContaOk(boolean contaOk) {
        this.contaOk = contaOk;
    }
}
