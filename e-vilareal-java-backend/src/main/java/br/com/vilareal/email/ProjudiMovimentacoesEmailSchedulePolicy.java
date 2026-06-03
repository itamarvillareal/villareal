package br.com.vilareal.email;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * Perfis horários do pipeline PROJUDI (America/Sao_Paulo): noturno, comercial, fim de semana.
 */
@Component
public class ProjudiMovimentacoesEmailSchedulePolicy {

    public enum PerfilNome {
        NOTURNO,
        COMERCIAL,
        FIM_DE_SEMANA
    }

    public record PerfilAtivo(
            PerfilNome nome,
            int intervaloMinutos,
            int delaySegundosEntreProcessos,
            int maxProcessosPorCiclo) {}

    private final ProjudiMovimentacoesEmailPipelineProperties properties;
    private final Clock clock;

    public ProjudiMovimentacoesEmailSchedulePolicy(
            ProjudiMovimentacoesEmailPipelineProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    public PerfilAtivo resolverPerfilAtual() {
        ZonedDateTime agora = ZonedDateTime.now(clock.withZone(zoneId()));
        PerfilNome nome = classificar(agora);
        ProjudiMovimentacoesEmailPipelineProperties.PerfilConfig cfg = configPara(nome);
        return new PerfilAtivo(
                nome,
                Math.max(1, cfg.getIntervaloMinutos()),
                Math.max(0, cfg.getDelaySegundosEntreProcessos()),
                Math.max(0, cfg.getMaxProcessosPorCiclo()));
    }

    static PerfilNome classificar(ZonedDateTime agora) {
        DayOfWeek dow = agora.getDayOfWeek();
        if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) {
            return PerfilNome.FIM_DE_SEMANA;
        }
        int hora = agora.getHour();
        if (hora >= 22 || hora < 6) {
            return PerfilNome.NOTURNO;
        }
        return PerfilNome.COMERCIAL;
    }

    private ProjudiMovimentacoesEmailPipelineProperties.PerfilConfig configPara(PerfilNome nome) {
        if (!properties.isScheduleEnabled()) {
            return properties.getNoturno();
        }
        return switch (nome) {
            case NOTURNO -> properties.getNoturno();
            case COMERCIAL -> properties.getComercial();
            case FIM_DE_SEMANA -> properties.getFimDeSemana();
        };
    }

    private ZoneId zoneId() {
        try {
            return ZoneId.of(properties.getTimezone());
        } catch (Exception e) {
            return ZoneId.of("America/Sao_Paulo");
        }
    }
}
