package br.com.vilareal.documento;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Parcela informada manualmente na Cláusula 3ª (valor e vencimento editáveis). */
public record ContratoHonorariosParcelaClausula3(
        Integer numero, BigDecimal valor, LocalDate dataVencimento) {}
