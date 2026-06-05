package br.com.vilareal.notificacao.api.dto;

import java.util.List;

/** Corpo de PUT para substituir destinatários (padrão global ou override de processo). */
public record DestinatariosCanaisRequest(List<String> whatsapp, List<String> email) {}
