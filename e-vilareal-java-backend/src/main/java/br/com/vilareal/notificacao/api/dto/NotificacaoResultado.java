package br.com.vilareal.notificacao.api.dto;

import br.com.vilareal.notificacao.domain.NotificacaoEnvioStatus;

/**
 * Resultado estruturado do envio de e-mail de novidade (monitor PROJUDI).
 */
public record NotificacaoResultado(NotificacaoEnvioStatus status, String destinatarios, String erro) {

    public static NotificacaoResultado naoAplicavel() {
        return new NotificacaoResultado(NotificacaoEnvioStatus.NAO_APLICAVEL, null, null);
    }

    public static NotificacaoResultado semDestinatario() {
        return new NotificacaoResultado(NotificacaoEnvioStatus.SEM_DESTINATARIO, null, null);
    }

    public static NotificacaoResultado enviado(String destinatarios) {
        return new NotificacaoResultado(NotificacaoEnvioStatus.ENVIADO, destinatarios, null);
    }

    public static NotificacaoResultado falha(String destinatarios, String erro) {
        return new NotificacaoResultado(NotificacaoEnvioStatus.FALHA, destinatarios, erro);
    }
}
