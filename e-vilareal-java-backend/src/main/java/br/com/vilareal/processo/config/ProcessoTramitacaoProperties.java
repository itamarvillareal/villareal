package br.com.vilareal.processo.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "processo.tramitacao")
public class ProcessoTramitacaoProperties {

    private InferirMonitoramento inferirMonitoramento = new InferirMonitoramento();

    public InferirMonitoramento getInferirMonitoramento() {
        return inferirMonitoramento;
    }

    public void setInferirMonitoramento(InferirMonitoramento inferirMonitoramento) {
        this.inferirMonitoramento = inferirMonitoramento != null ? inferirMonitoramento : new InferirMonitoramento();
    }

    public boolean isInferirMonitoramentoEnabled() {
        return inferirMonitoramento.isEnabled();
    }

    public static class InferirMonitoramento {
        private boolean enabled = true;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }
    }
}
