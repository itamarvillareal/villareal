package br.com.vilareal.projudi.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/** E-mails do escritório para andamento de protocolo PROJUDI (início e resultado). */
@ConfigurationProperties(prefix = "vilareal.projudi.protocolo.email")
public class ProjudiProtocoloEmailProperties {

    private boolean ativo = true;
    private String fromNome = "Protocolo Villa Real";
    private String assuntoPrefixo = "[Protocolo PROJUDI]";
    private List<String> destinatarios = new ArrayList<>();

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
