package br.com.vilareal.documento.api.dto;

import br.com.vilareal.documento.domain.StatusRepasseHonorario;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RepassePendenteHonorarioItemResponse(
        Long alvaraVinculoId,
        Long contratoHonorariosId,
        Long processoId,
        String codigoCliente,
        Integer numeroInterno,
        Long alvaraLancamentoId,
        LocalDate dataReferencia,
        Long contratantePessoaId,
        String contratanteNome,
        BigDecimal valorAlvara,
        BigDecimal percentualProveito,
        BigDecimal retencao,
        BigDecimal repasseEsperado,
        BigDecimal repassado,
        BigDecimal valorEmAberto,
        StatusRepasseHonorario statusRepasse,
        boolean requerRevisao) {}
