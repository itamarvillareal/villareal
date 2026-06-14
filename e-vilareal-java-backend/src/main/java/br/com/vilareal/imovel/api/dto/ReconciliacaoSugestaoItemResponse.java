package br.com.vilareal.imovel.api.dto;

import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.imovel.domain.PapelReconciliacao;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Sugestão de papel para um lançamento candidato do caixa do imóvel. */
public record ReconciliacaoSugestaoItemResponse(
        Long lancamentoFinanceiroId,
        LocalDate data,
        String descricao,
        String descricaoNorm,
        BigDecimal valor,
        String natureza,
        PapelReconciliacao papelSugerido,
        ConfiancaSugestao confianca,
        String competenciaSugerida,
        boolean jaVinculado,
        PapelReconciliacao papelVinculado,
        Long vinculoId,
        /** PROCESSO = já no processo do imóvel; ORFAO = sem processo, será adotado ao confirmar. */
        String origem,
        /** true quando o lançamento será classificado (A + cliente + proc) ao confirmar. */
        boolean classificaAoConfirmar,
        /** Pré-visualização do alvo de classificação (só para órfãos). */
        String codigoClienteAlvo,
        Long processoIdAlvo) {}
