package br.com.vilareal.monitoramento.api.dto;

import br.com.vilareal.monitoramento.infrastructure.persistence.entity.SegredoJusticaContagemEntity;

import java.time.Instant;

/** Contagem de processos em segredo de justiça por serventia, de uma pessoa monitorada. */
public record SegredoContagemResponse(String serventia, Integer qtd, Instant atualizadoEm) {

    public static SegredoContagemResponse de(SegredoJusticaContagemEntity e) {
        return new SegredoContagemResponse(e.getServentia(), e.getQtd(), e.getAtualizadoEm());
    }
}
