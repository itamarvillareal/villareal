package br.com.vilareal.calculo.application;

import java.util.List;

/**
 * Resultado do merge de débitos por dimensão — suficiente para texto de andamento e relatório PDF.
 */
public record ResultadoMerge(List<DimensaoTocada> dimensoesTocadas, List<DebitoIgnorado> debitosIgnorados) {

    public static final String MOTIVO_DEBITO_JA_EXISTE = "já existe (mesmo vencimento+valor)";

    public record DimensaoTocada(int dimensao, boolean dimensaoCriada, List<InsercaoDebito> insercoes) {}

    /** Posição 0-based no array {@code titulos[]} após a inserção, na dimensão indicada. */
    public record InsercaoDebito(int dimensao, int posicao, DebitoNovo debito) {}

    /** Débito já presente em alguma dimensão (chave vencimento+centavos). */
    public record DebitoIgnorado(String vencimento, long valorCentavos, String descricao, int dimensaoExistente) {

        public static DebitoIgnorado of(DebitoNovo debito, int dimensaoExistente) {
            return new DebitoIgnorado(
                    debito.vencimento(),
                    debito.valorCentavos(),
                    debito.descricao() != null ? debito.descricao() : "",
                    dimensaoExistente);
        }

        public String motivo() {
            return MOTIVO_DEBITO_JA_EXISTE;
        }
    }
}
