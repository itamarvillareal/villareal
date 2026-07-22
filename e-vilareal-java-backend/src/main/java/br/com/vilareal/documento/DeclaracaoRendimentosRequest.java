package br.com.vilareal.documento;

import java.time.LocalDate;

public record DeclaracaoRendimentosRequest(
        Long pessoaId,
        Boolean exerceAtividadeRemunerada,
        String codigoCliente,
        Integer numeroInterno,
        String cidadeEstado,
        LocalDate data,
        Long processoId) {}
