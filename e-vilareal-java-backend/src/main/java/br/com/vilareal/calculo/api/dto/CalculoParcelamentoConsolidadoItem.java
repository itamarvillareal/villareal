package br.com.vilareal.calculo.api.dto;

import java.time.LocalDate;

public record CalculoParcelamentoConsolidadoItem(
        String chaveRodada,
        String codigoCliente,
        int numeroProcesso,
        int dimensao,
        Long processoId,
        String parteOposta,
        String unidade,
        int parcelaNumero,
        int totalParcelas,
        LocalDate dataVencimento,
        LocalDate dataPagamento,
        long valorCentavos,
        long honorariosCentavos,
        String situacao,
        int diasAtraso,
        boolean extratoVinculado,
        Long lancamentoFinanceiroId,
        Integer bancoNumero,
        String bancoNome,
        int proximaDimensaoLivre,
        boolean dimensaoDescumpridoJaExiste) {}
