package br.com.vilareal.whatsapp.dto;

import java.util.List;

public record IniciarTelefonesResponseDTO(
        Long pessoaId,
        Long clienteId,
        String contactName,
        List<IniciarTelefoneItemDTO> telefones) {}
