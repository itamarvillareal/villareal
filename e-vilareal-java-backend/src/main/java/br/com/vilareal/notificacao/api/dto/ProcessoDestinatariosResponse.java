package br.com.vilareal.notificacao.api.dto;

/** Destinatários de um processo: override salvo, flag de personalização e listas efetivas (resolver). */
public record ProcessoDestinatariosResponse(
        DestinatariosCanaisDto override,
        boolean personalizado,
        DestinatariosCanaisDto efetivo) {}
