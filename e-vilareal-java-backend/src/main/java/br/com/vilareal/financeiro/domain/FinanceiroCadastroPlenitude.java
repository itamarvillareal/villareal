package br.com.vilareal.financeiro.domain;

/**
 * Regras de cadastro pleno vs parcial de lançamentos financeiros.
 * <p>
 * <strong>Parcial</strong>: primeira classificação (conta contábil) definida, mas falta
 * classificação secundária exigida pela conta (ex.: A sem cliente/processo; E sem grupo de compensação).
 * <p>
 * <strong>Pleno</strong>: todos os vínculos exigidos para a conta estão preenchidos.
 * Lançamentos em N (importado) não entram em nenhum dos dois filtros.
 */
public final class FinanceiroCadastroPlenitude {

    public static final String PLENO = "PLENO";
    public static final String PARCIAL = "PARCIAL";

    private FinanceiroCadastroPlenitude() {
    }

    public static String normalizarFiltro(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String v = raw.trim().toUpperCase();
        if (PLENO.equals(v) || PARCIAL.equals(v)) {
            return v;
        }
        return null;
    }
}
