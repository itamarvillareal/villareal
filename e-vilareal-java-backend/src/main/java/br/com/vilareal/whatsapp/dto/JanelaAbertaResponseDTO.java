package br.com.vilareal.whatsapp.dto;

import java.time.Instant;

public record JanelaAbertaResponseDTO(boolean janelaAberta, Instant ultimaInboundAt) {}
