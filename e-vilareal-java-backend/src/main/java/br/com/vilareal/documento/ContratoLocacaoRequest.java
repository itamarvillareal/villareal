package br.com.vilareal.documento;

import java.time.LocalDate;

public record ContratoLocacaoRequest(
        Long contratoLocacaoId,
        /** Ex.: {@code COM CAUÇÃO}, {@code GERAL - Multa fixa} — sufixo após {@code CONTRATOS=LOCAÇÃO=}. */
        String variante,
        String codigoCliente,
        Integer numeroInterno,
        String cidadeEstado,
        LocalDate data,
        /** {@code duas_vias} (padrão) ou {@code via_digital}. */
        String formaAssinatura) {}
