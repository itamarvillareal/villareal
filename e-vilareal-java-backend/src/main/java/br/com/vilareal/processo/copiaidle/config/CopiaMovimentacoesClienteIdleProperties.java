package br.com.vilareal.processo.copiaidle.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@ConfigurationProperties(prefix = "vilareal.processo.copia-movimentacoes-cliente-idle")
public class CopiaMovimentacoesClienteIdleProperties {

    /** Liga o scheduler (madrugada + idle). */
    private boolean enabled = true;

    /** Código do cliente com 8 dígitos (ex.: 00000728). */
    private String codigoCliente = "00000728";

    private String zone = "America/Sao_Paulo";

    /** Hora inclusiva de início da janela (0–23). */
    private int horaInicio = 1;

    /** Hora exclusiva de fim da janela (0–23). Ex.: 6 → até 05:59. */
    private int horaFim = 6;

    /** Intervalo entre ticks do scheduler (ms). */
    private long intervaloMs = 120_000L;

    /** Tentativas de erro transitório antes de marcar ERRO. */
    private int maxTentativasErro = 8;

    private final Email email = new Email();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getCodigoCliente() {
        return codigoCliente;
    }

    public void setCodigoCliente(String codigoCliente) {
        this.codigoCliente = codigoCliente;
    }

    public String getZone() {
        return zone;
    }

    public void setZone(String zone) {
        this.zone = zone;
    }

    public int getHoraInicio() {
        return horaInicio;
    }

    public void setHoraInicio(int horaInicio) {
        this.horaInicio = horaInicio;
    }

    public int getHoraFim() {
        return horaFim;
    }

    public void setHoraFim(int horaFim) {
        this.horaFim = horaFim;
    }

    public long getIntervaloMs() {
        return intervaloMs;
    }

    public void setIntervaloMs(long intervaloMs) {
        this.intervaloMs = intervaloMs;
    }

    public int getMaxTentativasErro() {
        return maxTentativasErro;
    }

    public void setMaxTentativasErro(int maxTentativasErro) {
        this.maxTentativasErro = maxTentativasErro;
    }

    public Email getEmail() {
        return email;
    }

    public static class Email {
        private boolean ativo = true;
        private String fromNome = "Cópia Movimentações Villa Real";
        private String assuntoPrefixo = "[Cópia movimentações]";
        private List<String> destinatarios = new ArrayList<>(List.of("jr.villareal@gmail.com"));

        public boolean isAtivo() {
            return ativo;
        }

        public void setAtivo(boolean ativo) {
            this.ativo = ativo;
        }

        public String getFromNome() {
            return fromNome;
        }

        public void setFromNome(String fromNome) {
            this.fromNome = fromNome;
        }

        public String getAssuntoPrefixo() {
            return assuntoPrefixo;
        }

        public void setAssuntoPrefixo(String assuntoPrefixo) {
            this.assuntoPrefixo = assuntoPrefixo;
        }

        public List<String> getDestinatarios() {
            return destinatarios;
        }

        public void setDestinatarios(List<String> destinatarios) {
            this.destinatarios = destinatarios != null ? destinatarios : new ArrayList<>();
        }
    }
}
