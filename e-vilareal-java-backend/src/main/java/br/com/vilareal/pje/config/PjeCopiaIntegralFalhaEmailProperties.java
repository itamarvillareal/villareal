package br.com.vilareal.pje.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/** E-mail ao esgotar retentativas da cópia integral PJe TRT18. */
@ConfigurationProperties(prefix = "vilareal.pje.copia-integral.falha.email")
public class PjeCopiaIntegralFalhaEmailProperties {

    private boolean ativo = true;
    private String fromNome = "Robô PJe Villa Real";
    private String assuntoPrefixo = "[PJe TRT18 — falha]";
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
