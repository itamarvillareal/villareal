package br.com.vilareal.notificacao.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuração de envio de e-mail do monitor (remetente = conta OAuth Gmail). */
@ConfigurationProperties(prefix = "vilareal.notificacao.email")
public class NotificacaoEmailProperties {

    private boolean ativo = true;
    private String fromNome = "Monitor Villa Real";
    private String assuntoPrefixo = "[Monitor]";

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
}
