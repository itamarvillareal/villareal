package br.com.vilareal.documento.importacao.api.dto;

import br.com.vilareal.documento.ContratoHonorariosClausula3Dados;
import br.com.vilareal.documento.ContratoHonorariosParcelaClausula3;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Dados extraídos/aprovados de um contrato de honorários (IA + revisão humana). */
public record ContratoHonorariosExtracaoDados(
        String tipoRemuneracao,
        BigDecimal percentualProveito,
        BigDecimal valorFixo,
        Boolean temParcelamento,
        Boolean gerarRecebiveis,
        Integer quantidadeParcelas,
        BigDecimal valorTotalParcelas,
        LocalDate primeiroVencimento,
        String intervaloParcelas,
        String formaPagamento,
        List<ContratoHonorariosParcelaClausula3> parcelas,
        LocalDate dataContrato,
        String objetoContrato,
        String formaAssinatura,
        String numeroCnjExtraido,
        String partesExtraidas,
        BigDecimal valorCausaExtraido,
        boolean temCasoVinculado) {

    public ContratoHonorariosClausula3Dados toClausula3Dados() {
        return new ContratoHonorariosClausula3Dados(
                tipoRemuneracao,
                percentualProveito,
                valorFixo,
                temParcelamento,
                gerarRecebiveis,
                quantidadeParcelas,
                valorTotalParcelas,
                primeiroVencimento,
                intervaloParcelas,
                formaPagamento,
                parcelas);
    }
}
