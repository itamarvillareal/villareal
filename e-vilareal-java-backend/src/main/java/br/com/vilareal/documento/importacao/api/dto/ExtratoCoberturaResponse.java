package br.com.vilareal.documento.importacao.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ExtratoCoberturaResponse(
        LocalDate periodoDe,
        LocalDate periodoAte,
        boolean suficiente,
        int totalCreditos,
        List<String> avisos) {}
