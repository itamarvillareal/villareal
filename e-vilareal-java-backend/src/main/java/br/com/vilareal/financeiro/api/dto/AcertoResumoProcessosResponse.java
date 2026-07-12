package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/** Visão do acerto agrupada por processo + progresso de conferência (Etapa 5/5b). */
@Getter
@Setter
public class AcertoResumoProcessosResponse {

    private List<AcertoResumoProcessoResponse> processos = new ArrayList<>();
    /** Total de procs do recorte (antes dos filtros apenasPendentes/apenasNaoConferidos). */
    private long totalProcessos;
    /** Procs com todos os lançamentos conferidos (progresso: X de Y). */
    private long processosConferidos;
    private long totalLancamentos;
    private long lancamentosNaoConferidos;
}
