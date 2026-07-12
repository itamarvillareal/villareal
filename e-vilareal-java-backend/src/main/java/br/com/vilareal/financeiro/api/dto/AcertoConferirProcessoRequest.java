package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

/**
 * Conferência em cascata por processo (Etapa 5b): marca/desmarca todos os lançamentos do proc
 * (ou dos sem proc, quando {@code processoId} nulo) no recorte cliente/pessoa da conta de acerto.
 */
@Getter
@Setter
public class AcertoConferirProcessoRequest {

    @NotNull
    private Integer numeroBanco;

    /** Vínculo do recorte: cliente OU pessoa (um dos dois). */
    private Long clienteId;

    private Long pessoaRefId;

    /** Nulo = grupo dos lançamentos sem processo (mensalidades e avulsos). */
    private Long processoId;

    @NotNull
    private Boolean conferido;
}
