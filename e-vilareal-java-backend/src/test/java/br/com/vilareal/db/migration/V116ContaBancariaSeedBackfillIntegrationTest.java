package br.com.vilareal.db.migration;

import br.com.vilareal.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Date;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Valida o SEED e o BACKFILL do V116 (conta_bancaria) em MySQL real (Testcontainers).
 *
 * <p>Como o seed é data-driven (não inventa banco), num container vazio ele não cria nada na
 * migração; o teste insere lançamentos representativos e RE-EXECUTA o mesmo SQL de seed/backfill
 * do V116 (constantes abaixo) para exercitar a regra.
 */
class V116ContaBancariaSeedBackfillIntegrationTest extends AbstractIntegrationTest {

    private static final String SEED_INSERT =
            """
            INSERT INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo)
            SELECT
                nb.numero_banco,
                NULL,
                CASE
                    WHEN nb.numero_banco = 900 THEN 'VIRTUAL'
                    WHEN nb.numero_banco IN (9, 17, 18) THEN 'MANUAL'
                    ELSE 'REAL'
                END,
                CASE WHEN nb.numero_banco IN (900, 9, 17, 18) THEN FALSE ELSE TRUE END,
                TRUE
            FROM (
                SELECT DISTINCT numero_banco FROM financeiro_lancamento WHERE numero_banco IS NOT NULL
                UNION
                SELECT DISTINCT numero_banco FROM financeiro_saldo_inicial WHERE numero_banco IS NOT NULL
            ) nb
            """;

    private static final String SEED_NOME =
            """
            UPDATE conta_bancaria cb
            JOIN (
                SELECT numero_banco, banco_nome FROM (
                    SELECT numero_banco, banco_nome,
                           ROW_NUMBER() OVER (PARTITION BY numero_banco ORDER BY total DESC, banco_nome ASC) rn
                    FROM (
                        SELECT numero_banco, banco_nome, SUM(c) total FROM (
                            SELECT numero_banco, banco_nome, COUNT(*) c
                            FROM financeiro_lancamento
                            WHERE numero_banco IS NOT NULL AND banco_nome IS NOT NULL
                            GROUP BY numero_banco, banco_nome
                            UNION ALL
                            SELECT numero_banco, banco_nome, COUNT(*) c
                            FROM financeiro_saldo_inicial
                            WHERE numero_banco IS NOT NULL AND banco_nome IS NOT NULL
                            GROUP BY numero_banco, banco_nome
                        ) u
                        GROUP BY numero_banco, banco_nome
                    ) ranked
                ) m
                WHERE m.rn = 1
            ) nome ON nome.numero_banco = cb.numero_banco
            SET cb.banco_nome = nome.banco_nome
            """;

    private static final String BACKFILL =
            """
            UPDATE financeiro_lancamento fl
            JOIN conta_bancaria cb ON cb.numero_banco = fl.numero_banco
            SET fl.conta_bancaria_id = cb.id
            WHERE fl.numero_banco IS NOT NULL
            """;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @Transactional
    void seed_classificaTipoETemExtratoPorNumeroBanco() {
        inserirLancamento(900, "REPASSE INTERNO", "L-900");
        inserirLancamento(9, "Caixa Manual 9", "L-9");
        inserirLancamento(17, "Caixa Manual 17", "L-17");
        inserirLancamento(18, "Caixa Manual 18", "L-18");
        inserirLancamento(1, "Banco Real Um", "L-1");

        jdbcTemplate.update(SEED_INSERT);
        jdbcTemplate.update(SEED_NOME);

        // 900 -> VIRTUAL / sem extrato
        assertThat(tipo(900)).isEqualTo("VIRTUAL");
        assertThat(temExtrato(900)).isFalse();
        // 9, 17, 18 -> MANUAL / sem extrato
        for (int nb : new int[] {9, 17, 18}) {
            assertThat(tipo(nb)).isEqualTo("MANUAL");
            assertThat(temExtrato(nb)).isFalse();
        }
        // banco real -> REAL / com extrato
        assertThat(tipo(1)).isEqualTo("REAL");
        assertThat(temExtrato(1)).isTrue();
    }

    @Test
    @Transactional
    void seed_bancoNomeCanonicoEhOMaisFrequenteNaoNulo() {
        // numero_banco 1: 'Banco Real Um' aparece 2x, 'Outro Nome' 1x e um NULL -> canônico = 'Banco Real Um'
        inserirLancamento(1, "Banco Real Um", "L-1a");
        inserirLancamento(1, "Banco Real Um", "L-1b");
        inserirLancamento(1, "Outro Nome", "L-1c");
        inserirLancamento(1, null, "L-1d");

        jdbcTemplate.update(SEED_INSERT);
        jdbcTemplate.update(SEED_NOME);

        String nome = jdbcTemplate.queryForObject(
                "SELECT banco_nome FROM conta_bancaria WHERE numero_banco = 1", String.class);
        assertThat(nome).isEqualTo("Banco Real Um");
    }

    @Test
    @Transactional
    void backfill_preencheTodoLancamentoComNumeroBancoENaoTocaNulos() {
        inserirLancamento(900, "REPASSE INTERNO", "B-900");
        inserirLancamento(9, "Caixa Manual 9", "B-9");
        inserirLancamento(1, "Banco Real Um", "B-1");
        inserirLancamento(null, "Sem numero", "B-null"); // numero_banco NULL -> FK NULL

        jdbcTemplate.update(SEED_INSERT);
        jdbcTemplate.update(SEED_NOME);
        jdbcTemplate.update(BACKFILL);

        // todo lançamento com numero_banco não-nulo tem conta_bancaria_id preenchido
        Integer pendentes = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM financeiro_lancamento WHERE numero_banco IS NOT NULL AND conta_bancaria_id IS NULL",
                Integer.class);
        assertThat(pendentes).isZero();

        // numero_banco NULL -> conta_bancaria_id NULL
        Long contaDoNulo = jdbcTemplate.queryForObject(
                "SELECT conta_bancaria_id FROM financeiro_lancamento WHERE numero_lancamento = 'B-null'",
                Long.class);
        assertThat(contaDoNulo).isNull();

        // e a ligação respeita o numero_banco (ex.: 900)
        Long conta900 = jdbcTemplate.queryForObject(
                "SELECT cb.numero_banco FROM financeiro_lancamento fl "
                        + "JOIN conta_bancaria cb ON cb.id = fl.conta_bancaria_id WHERE fl.numero_lancamento = 'B-900'",
                Long.class);
        assertThat(conta900).isEqualTo(900L);
    }

    // ---------------------------------------------------------------- helpers

    private void inserirLancamento(Integer numeroBanco, String bancoNome, String numeroLancamento) {
        Long contaContabilId = jdbcTemplate.queryForObject(
                "SELECT id FROM financeiro_conta_contabil ORDER BY id LIMIT 1", Long.class);
        jdbcTemplate.update(
                "INSERT INTO financeiro_lancamento "
                        + "(conta_contabil_id, numero_banco, banco_nome, numero_lancamento, data_lancamento, descricao, valor, natureza) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                contaContabilId, numeroBanco, bancoNome, numeroLancamento,
                Date.valueOf("2026-01-01"), "lanc teste", new BigDecimal("10.00"), "CREDITO");
    }

    private String tipo(int numeroBanco) {
        return jdbcTemplate.queryForObject(
                "SELECT tipo FROM conta_bancaria WHERE numero_banco = ?", String.class, numeroBanco);
    }

    private Boolean temExtrato(int numeroBanco) {
        return jdbcTemplate.queryForObject(
                "SELECT tem_extrato FROM conta_bancaria WHERE numero_banco = ?", Boolean.class, numeroBanco);
    }
}
