package br.com.vilareal.notificacao.api.dto;

import java.util.List;

/** Listas de destinatários por canal (valores já normalizados na resposta). */
public record DestinatariosCanaisDto(List<String> whatsapp, List<String> email) {

    public DestinatariosCanaisDto {
        whatsapp = whatsapp != null ? List.copyOf(whatsapp) : List.of();
        email = email != null ? List.copyOf(email) : List.of();
    }

    public static DestinatariosCanaisDto vazio() {
        return new DestinatariosCanaisDto(List.of(), List.of());
    }
}
