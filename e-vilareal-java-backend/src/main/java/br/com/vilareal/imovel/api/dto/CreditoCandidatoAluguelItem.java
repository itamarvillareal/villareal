package br.com.vilareal.imovel.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Crédito Cora na faixa do aluguel, ainda sem vínculo ALUGUEL (somente leitura). */
public record CreditoCandidatoAluguelItem(
        Long lancamentoId, LocalDate data, BigDecimal valor, String descricao) {}
