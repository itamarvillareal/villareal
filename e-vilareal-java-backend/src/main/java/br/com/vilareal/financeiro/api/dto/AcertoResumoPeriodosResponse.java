package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Timeline de períodos do acerto (Etapa 5c). */
@Getter
@Setter
public class AcertoResumoPeriodosResponse {

    private List<AcertoResumoPeriodoResponse> periodos = new ArrayList<>();

    /** Índice do período ABERTO na lista ({@code null} se não houver). */
    private Integer periodoAbertoIndice;

    /** Data fim do último período fechado (corte efetivo para a mesa de trabalho). */
    private LocalDate ultimoCorteData;

    /** Corte manual configurado na Ficha ({@code acerto_cliente_config}). */
    private LocalDate dataUltimoAcertoConhecido;
}
