package br.com.vilareal.whatsapp.dto;

import java.util.List;

public record WhatsAppGrupoSalvarRequest(String clienteCodigo, List<String> phoneNumbers) {}
