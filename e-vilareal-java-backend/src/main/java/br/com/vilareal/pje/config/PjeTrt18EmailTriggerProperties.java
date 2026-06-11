package br.com.vilareal.pje.config;

import br.com.vilareal.pje.domain.PjeGrau;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "pje.trt18")
public class PjeTrt18EmailTriggerProperties {

    private String loginPadrao = "";
    private String grauPadrao = "PRIMEIRO_GRAU";
    private int copiaIntegralMinIntervaloMin = 0;

    public String getLoginPadrao() {
        return loginPadrao;
    }

    public void setLoginPadrao(String loginPadrao) {
        this.loginPadrao = loginPadrao != null ? loginPadrao : "";
    }

    public PjeGrau getGrauPadrao() {
        if (grauPadrao == null || grauPadrao.isBlank()) {
            return PjeGrau.PRIMEIRO_GRAU;
        }
        try {
            return PjeGrau.valueOf(grauPadrao.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return PjeGrau.PRIMEIRO_GRAU;
        }
    }

    public void setGrauPadrao(String grauPadrao) {
        this.grauPadrao = grauPadrao;
    }

    public int getCopiaIntegralMinIntervaloMin() {
        return copiaIntegralMinIntervaloMin;
    }

    public void setCopiaIntegralMinIntervaloMin(int copiaIntegralMinIntervaloMin) {
        this.copiaIntegralMinIntervaloMin = Math.max(0, copiaIntegralMinIntervaloMin);
    }
}
