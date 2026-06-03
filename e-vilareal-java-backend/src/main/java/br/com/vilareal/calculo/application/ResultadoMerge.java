package br.com.vilareal.calculo.application;

import java.util.List;

/**
 * Resultado do merge de débitos por dimensão — suficiente para texto de andamento.
 */
public record ResultadoMerge(List<DimensaoTocada> dimensoesTocadas, List<DebitoIgnorado> debitosIgnorados) {

    public record DimensaoTocada(int dimensao, boolean dimensaoCriada, List<InsercaoDebito> insercoes) {}

    /** Posição 0-based no array {@code titulos[]} após a inserção. */
    public record InsercaoDebito(int posicao, DebitoNovo debito) {}

    /** Débito já presente em alguma dimensão (chave vencimento+centavos). */
    public record DebitoIgnorado(DebitoNovo debito, int dimensaoExistente) {}
}
