package br.com.vilareal.financeiro.domain;

/**
 * Expressão SQL equivalente a {@link CompensacaoDateUtils#normalizarParaDiaUtil(java.time.LocalDate)}
 * (sexta/sábado/domingo → segunda seguinte).
 */
public final class CompensacaoSqlDiaUtil {

    private static final String NORMALIZAR_A_DATA_LANCAMENTO = """
            CASE DAYOFWEEK(a.data_lancamento)
                WHEN 6 THEN DATE_ADD(a.data_lancamento, INTERVAL 3 DAY)
                WHEN 7 THEN DATE_ADD(a.data_lancamento, INTERVAL 2 DAY)
                WHEN 1 THEN DATE_ADD(a.data_lancamento, INTERVAL 1 DAY)
                ELSE a.data_lancamento
            END""";

    private static final String NORMALIZAR_B_DATA_LANCAMENTO = """
            CASE DAYOFWEEK(b.data_lancamento)
                WHEN 6 THEN DATE_ADD(b.data_lancamento, INTERVAL 3 DAY)
                WHEN 7 THEN DATE_ADD(b.data_lancamento, INTERVAL 2 DAY)
                WHEN 1 THEN DATE_ADD(b.data_lancamento, INTERVAL 1 DAY)
                ELSE b.data_lancamento
            END""";

    /** Predicado de join para pares sugeridos (a/b em {@code financeiro_lancamento}). Constante para {@code @Query}. */
    public static final String MESMO_DIA_UTIL_BANCARIO_JOIN_AB =
            NORMALIZAR_A_DATA_LANCAMENTO + " = " + NORMALIZAR_B_DATA_LANCAMENTO;

    private static final String NORMALIZAR_TEMPLATE =
            """
            CASE DAYOFWEEK(%s)
                WHEN 6 THEN DATE_ADD(%s, INTERVAL 3 DAY)
                WHEN 7 THEN DATE_ADD(%s, INTERVAL 2 DAY)
                WHEN 1 THEN DATE_ADD(%s, INTERVAL 1 DAY)
                ELSE %s
            END""";

    private CompensacaoSqlDiaUtil() {}

    public static String normalizarColuna(String colunaData) {
        return NORMALIZAR_TEMPLATE.formatted(colunaData, colunaData, colunaData, colunaData, colunaData);
    }

    /** Predicado de join: mesmo dia útil bancário entre duas colunas de data. */
    public static String mesmoDiaUtilBancario(String colA, String colB) {
        return normalizarColuna(colA) + " = " + normalizarColuna(colB);
    }
}
