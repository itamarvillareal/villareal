package br.com.vilareal.imovel.api.dto;

import br.com.vilareal.imovel.domain.PapelReconciliacao;

import java.math.BigDecimal;

/** Vínculo persistido em {@code locacao_repasse_lancamento}. */
public record ReconciliacaoVinculoResponse(
        Long id,
        Long contratoId,
        Long lancamentoFinanceiroId,
        PapelReconciliacao papel,
        String competenciaMes,
        BigDecimal valor,
        /** true quando o lançamento órfão foi adotado (classificado A + cliente + proc) neste confirm. */
        boolean adotado,
        String contaCodigoAplicada,
        Long processoAplicadoId,
        /** {@code AUTO} quando criado pela conciliação automática; {@code null} = manual. */
        String origem) {}
