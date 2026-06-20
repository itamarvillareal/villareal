package br.com.vilareal.documento;

import java.time.LocalDate;

public record ContratoAluguelRequest(
        Long processoId,
        String codigoCliente,
        Integer numeroInterno,
        String cidadeEstado,
        LocalDate data,
        /** {@code duas_vias} (padrão) ou {@code via_digital}. */
        String formaAssinatura) {}
