package br.com.vilareal.imovel.api.dto;

import br.com.vilareal.imovel.domain.PapelReconciliacao;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/** Confirma vínculos (caso a caso ou em lote) entre lançamentos do caixa e o ciclo. */
public record ReconciliacaoVincularRequest(@NotEmpty @Valid List<Item> vinculos) {

    public record Item(
            @NotNull Long lancamentoFinanceiroId,
            @NotNull PapelReconciliacao papel,
            String competenciaMes,
            /** Rótulo opcional da classificação manual (IPTU, condomínio, texto livre em "Outros"). */
            String rotuloClassificacao) {}
}
