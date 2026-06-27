package br.com.vilareal.documento;

import java.time.LocalDate;
import java.util.List;

public record ContratoLocacaoRequest(
        Long contratoLocacaoId,
        /** Ex.: {@code COM CAUÇÃO}, {@code GERAL - Multa fixa} — sufixo após {@code CONTRATOS=LOCAÇÃO=}. */
        String variante,
        String codigoCliente,
        Integer numeroInterno,
        String cidadeEstado,
        LocalDate data,
        /** {@code duas_vias} (padrão) ou {@code via_digital}. */
        String formaAssinatura,
        /** Opcional: locatários da UI (mescla com contrato e processo vinculado). */
        List<Long> inquilinosPessoaIds) {}
