package br.com.vilareal.documento;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ContratoHonorariosResumoResponse(
        Long id,
        Long processoId,
        Long pessoaId,
        String nomeContratante,
        String parteCliente,
        String parteOposta,
        String papelCliente,
        String codigoCliente,
        Integer numeroInterno,
        LocalDate dataContrato,
        String objetoContrato,
        String tipoRemuneracao,
        BigDecimal percentualProveito,
        BigDecimal valorFixo,
        BigDecimal valorTotalParcelas,
        Integer quantidadeParcelas,
        String formaPagamentoParcelas,
        Boolean gerarRecebiveis,
        int parcelasGeradas,
        String clausula3Texto,
        List<ContratoHonorariosParcelaResumoResponse> parcelas) {}
