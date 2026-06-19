package br.com.vilareal.publicacao.api.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public record TratarPublicacaoRequest(
        @NotBlank(message = "tipo é obrigatório.") String tipo,
        LocalDate dataFatal,
        String observacaoFase,
        Boolean contatarCliente) {}
