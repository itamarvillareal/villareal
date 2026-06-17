package br.com.vilareal.documento;

import java.time.LocalDate;

public record ProcuracaoRequest(
        Long pessoaId,
        String codigoCliente,
        Integer numeroInterno,
        String cidadeEstado,
        LocalDate data,
        Long processoId
) {}
