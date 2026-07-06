package br.com.vilareal.citacao.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "citacao.auto-link")
public class CitacaoAutoLinkProperties {

    /** Quando false, novas movimentações monitoradas não disparam auto-link de citação. */
    private boolean enabled = true;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
