package br.com.vilareal.processo.application.rag;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "vilareal.rag.indexacao")
public class RagIndexacaoProperties {

    private boolean enabled = false;
    private String python = "python3";
    /** Diretório pai do pacote {@code processo_rag} (contém a pasta processo_rag/). */
    private String scriptsDir = "";
    private int timeoutSegundos = 45;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getPython() {
        return python;
    }

    public void setPython(String python) {
        this.python = python;
    }

    public String getScriptsDir() {
        return scriptsDir;
    }

    public void setScriptsDir(String scriptsDir) {
        this.scriptsDir = scriptsDir;
    }

    public int getTimeoutSegundos() {
        return timeoutSegundos;
    }

    public void setTimeoutSegundos(int timeoutSegundos) {
        this.timeoutSegundos = timeoutSegundos;
    }
}
