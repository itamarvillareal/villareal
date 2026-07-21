package br.com.vilareal.email;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração do pipeline automático: Gmail PROJUDI + complemento Drive (movimentações).
 */
@ConfigurationProperties(prefix = "vilareal.email.projudi.pipeline")
public class ProjudiMovimentacoesEmailPipelineProperties {

    private boolean enabled = false;
    private int janelaDias = 7;
    private String timezone = "America/Sao_Paulo";
    private boolean scheduleEnabled = true;
    /**
     * Quando true, processos com cópia integral no Drive deixam de ser reconsultados no PROJUDI
     * até chegar publicação nova por e-mail.
     */
    private boolean desarmeAcervoIntegralEnabled = true;
    private PerfilConfig noturno = new PerfilConfig(15, 15, 60);
    private PerfilConfig comercial = new PerfilConfig(15, 60, 20);
    /** Binding: {@code vilareal.email.projudi.pipeline.perfil.fim-de-semana.*} */
    private PerfilConfig fimDeSemana = new PerfilConfig(15, 15, 60);

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getJanelaDias() {
        return janelaDias;
    }

    public void setJanelaDias(int janelaDias) {
        this.janelaDias = janelaDias;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public boolean isScheduleEnabled() {
        return scheduleEnabled;
    }

    public void setScheduleEnabled(boolean scheduleEnabled) {
        this.scheduleEnabled = scheduleEnabled;
    }

    public boolean isDesarmeAcervoIntegralEnabled() {
        return desarmeAcervoIntegralEnabled;
    }

    public void setDesarmeAcervoIntegralEnabled(boolean desarmeAcervoIntegralEnabled) {
        this.desarmeAcervoIntegralEnabled = desarmeAcervoIntegralEnabled;
    }

    public PerfilConfig getNoturno() {
        return noturno;
    }

    public void setNoturno(PerfilConfig noturno) {
        this.noturno = noturno;
    }

    public PerfilConfig getComercial() {
        return comercial;
    }

    public void setComercial(PerfilConfig comercial) {
        this.comercial = comercial;
    }

    public PerfilConfig getFimDeSemana() {
        return fimDeSemana;
    }

    public void setFimDeSemana(PerfilConfig fimDeSemana) {
        this.fimDeSemana = fimDeSemana;
    }

    public static final class PerfilConfig {
        private int intervaloMinutos = 10;
        private int delaySegundosEntreProcessos = 15;
        /** 0 = sem limite por ciclo. */
        private int maxProcessosPorCiclo = 0;

        public PerfilConfig() {}

        public PerfilConfig(int intervaloMinutos, int delaySegundosEntreProcessos, int maxProcessosPorCiclo) {
            this.intervaloMinutos = intervaloMinutos;
            this.delaySegundosEntreProcessos = delaySegundosEntreProcessos;
            this.maxProcessosPorCiclo = maxProcessosPorCiclo;
        }

        public int getIntervaloMinutos() {
            return intervaloMinutos;
        }

        public void setIntervaloMinutos(int intervaloMinutos) {
            this.intervaloMinutos = intervaloMinutos;
        }

        public int getDelaySegundosEntreProcessos() {
            return delaySegundosEntreProcessos;
        }

        public void setDelaySegundosEntreProcessos(int delaySegundosEntreProcessos) {
            this.delaySegundosEntreProcessos = delaySegundosEntreProcessos;
        }

        public int getMaxProcessosPorCiclo() {
            return maxProcessosPorCiclo;
        }

        public void setMaxProcessosPorCiclo(int maxProcessosPorCiclo) {
            this.maxProcessosPorCiclo = maxProcessosPorCiclo;
        }
    }
}
