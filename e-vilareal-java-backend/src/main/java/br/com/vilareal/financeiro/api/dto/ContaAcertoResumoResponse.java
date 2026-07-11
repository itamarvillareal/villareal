package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Resumo da conta de acerto (CONTA ZERO): pendências e saldo por vínculo. Alimenta o alerta de
 * "conta não zerada" — a conta totalmente conciliada tem {@code somaPendente} = 0.
 */
@Getter
@Setter
public class ContaAcertoResumoResponse {

    private Integer numeroBanco;
    /** Soma assinada (crédito − débito) de todos os lançamentos ativos da conta. */
    private BigDecimal somaConta;
    /** Soma assinada dos lançamentos sem grupo (pendências); 0 = conta conciliada. */
    private BigDecimal somaPendente;
    private long totalLancamentos;
    private long totalPendentes;
    private List<ContaAcertoResumoVinculoResponse> vinculos = new ArrayList<>();
}
