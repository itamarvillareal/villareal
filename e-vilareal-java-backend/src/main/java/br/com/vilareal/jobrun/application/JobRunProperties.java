package br.com.vilareal.jobrun.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.LinkedHashMap;
import java.util.Map;

@ConfigurationProperties(prefix = "vilareal.jobs")
public class JobRunProperties {

    private String instanceId = "local";
    private int heartbeatIntervalSeconds = 30;
    /** Runs RUNNING sem heartbeat há mais que isso → TIMEOUT. */
    private int orphanRunningGraceMinutes = 15;
    /** Últimos N runs em ERROR → health failing. */
    private int failingConsecutiveRuns = 3;
    private Map<String, JobDefinition> definitions = defaultDefinitions();

    public String getInstanceId() {
        return instanceId;
    }

    public void setInstanceId(String instanceId) {
        this.instanceId = instanceId;
    }

    public int getHeartbeatIntervalSeconds() {
        return heartbeatIntervalSeconds;
    }

    public void setHeartbeatIntervalSeconds(int heartbeatIntervalSeconds) {
        this.heartbeatIntervalSeconds = heartbeatIntervalSeconds;
    }

    public int getOrphanRunningGraceMinutes() {
        return orphanRunningGraceMinutes;
    }

    public void setOrphanRunningGraceMinutes(int orphanRunningGraceMinutes) {
        this.orphanRunningGraceMinutes = orphanRunningGraceMinutes;
    }

    public int getFailingConsecutiveRuns() {
        return failingConsecutiveRuns;
    }

    public void setFailingConsecutiveRuns(int failingConsecutiveRuns) {
        this.failingConsecutiveRuns = failingConsecutiveRuns;
    }

    public Map<String, JobDefinition> getDefinitions() {
        return definitions;
    }

    public void setDefinitions(Map<String, JobDefinition> definitions) {
        this.definitions = definitions != null ? definitions : defaultDefinitions();
    }

    public JobDefinition definitionFor(String jobName) {
        return definitions.getOrDefault(jobName, new JobDefinition(240, 120, jobName));
    }

    private static Map<String, JobDefinition> defaultDefinitions() {
        Map<String, JobDefinition> m = new LinkedHashMap<>();
        m.put("buscar_emails_projudi", new JobDefinition(200, 90, "Buscar emails PROJUDI"));
        m.put("atualizar_emails_projudi", new JobDefinition(10080, 180, "Atualização completa PROJUDI"));
        m.put("buscar_emails_publicacoes", new JobDefinition(200, 90, "Buscar emails publicações"));
        m.put("buscar_emails_trt", new JobDefinition(200, 90, "Buscar emails TRT"));
        m.put("pipeline_projudi_movimentacoes", new JobDefinition(30, 45, "Pipeline PROJUDI + Drive"));
        m.put("pagamento_rotina_diaria", new JobDefinition(1500, 30, "Pagamentos — rotina diária"));
        m.put("pagamento_recorrencia", new JobDefinition(44640, 60, "Pagamentos — recorrência mensal"));
        m.put("iptu_rotina_diaria", new JobDefinition(1500, 30, "IPTU — rotina diária"));
        m.put("whatsapp_agendamentos", new JobDefinition(5, 10, "WhatsApp — envio agendado"));
        m.put("whatsapp_lembrete_audiencia", new JobDefinition(1500, 30, "WhatsApp — lembrete audiência"));
        m.put("whatsapp_reforco_audiencia", new JobDefinition(1500, 30, "WhatsApp — reforço audiência"));
        m.put("whatsapp_aniversario", new JobDefinition(1500, 30, "WhatsApp — felicitações aniversário"));
        return m;
    }

    public static final class JobDefinition {
        /** Intervalo esperado entre sucessos (minutos) — acima disso = stale. */
        private int expectedIntervalMinutes = 240;
        /** Tempo máximo em RUNNING (minutos) — acima = stuck. */
        private int maxRunningMinutes = 90;
        private String displayName;

        public JobDefinition() {}

        public JobDefinition(int expectedIntervalMinutes, int maxRunningMinutes, String displayName) {
            this.expectedIntervalMinutes = expectedIntervalMinutes;
            this.maxRunningMinutes = maxRunningMinutes;
            this.displayName = displayName;
        }

        public int getExpectedIntervalMinutes() {
            return expectedIntervalMinutes;
        }

        public void setExpectedIntervalMinutes(int expectedIntervalMinutes) {
            this.expectedIntervalMinutes = expectedIntervalMinutes;
        }

        public int getMaxRunningMinutes() {
            return maxRunningMinutes;
        }

        public void setMaxRunningMinutes(int maxRunningMinutes) {
            this.maxRunningMinutes = maxRunningMinutes;
        }

        public String getDisplayName() {
            return displayName;
        }

        public void setDisplayName(String displayName) {
            this.displayName = displayName;
        }
    }
}
