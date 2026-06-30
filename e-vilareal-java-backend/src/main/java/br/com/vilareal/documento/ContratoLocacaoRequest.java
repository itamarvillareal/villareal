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
        List<Long> inquilinosPessoaIds,
        /** Opcional: vigência do formulário (sobrescreve contrato gravado só na geração do PDF). */
        LocalDate dataInicioContrato,
        LocalDate dataFimContrato,
        /** Opcional: valor mensal do formulário (sobrescreve contrato gravado só na geração do PDF). */
        java.math.BigDecimal valorAluguelContrato,
        /** Opcional: link da vistoria do formulário (sobrescreve imóvel gravado só na geração do PDF). */
        String linkVistoria,
        /** Opcional: dia de vencimento do formulário (sobrescreve contrato gravado só na geração do PDF). */
        Integer diaVencimentoAluguel,
        /** Opcional: {@code DEPOSITO_TED} ou {@code BOLETO} — Cláusula 3ª. */
        String formaPagamentoAluguel,
        /** Opcional: data da 1ª taxa condominial (§3º) — sobrescreve imóvel gravado só na geração do PDF. */
        LocalDate dataPagamentoPrimeiraTaxaCondominial,
        /** Opcional: conteúdo revisado na prévia (cláusulas editadas/excluídas). */
        ContratoLocacaoConteudoPreview conteudoEditado) {}
