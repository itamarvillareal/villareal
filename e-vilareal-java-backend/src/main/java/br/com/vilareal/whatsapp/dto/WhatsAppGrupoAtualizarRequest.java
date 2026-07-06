package br.com.vilareal.whatsapp.dto;

import java.util.List;

public record WhatsAppGrupoAtualizarRequest(List<String> phoneNumbers) {}
