package br.com.vilareal.whatsapp.dto;

import java.time.Instant;
import java.time.LocalDate;

public record AniversarioDTO(
        Long id,
        Long pessoaId,
        String pessoaNome,
        String phoneNumber,
        LocalDate dataAniversario,
        int anoEnvio,
        String status,
        String errorMessage,
        Instant createdAt) {}
