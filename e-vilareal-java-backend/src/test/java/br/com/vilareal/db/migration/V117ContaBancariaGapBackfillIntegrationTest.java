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
 * Valida o SEED de bancos novos e o RE-BACKFILL do V117 (fechamento do gap da FASE A) em MySQL real.
 *
 * <p>Reexecuta o mesmo SQL idempotente do V117 (constantes abaixo) sobre lançamentos representativos:
 * uma linha com banco já existente sem FK (gap) e um banco NOVO sem conta — provando que (a) o seed
 * cria a conta nova (REAL/com extrato) e (b) o re-backfill liga toda linha com numero_banco, sem
 * tocar nas de numero_banco NULL.
 */
class V117ContaBancariaGapBackfillIntegrationTest extends AbstractIntegrationTest {

    private static final String SEED_GAP =
            """
            INSERT IGNORE INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo)
            SELECT nb.numero_banco, NULL, 'REAL', TRUE, TRUE
            FROM (
                SELECT DISTINCT numero_banco FROM financeiro_lancamento WHERE numero_banco IS NOT NULL
            ) nb
            LEFT JOIN conta_bancaria cb ON cb.numero_banco = nb.numero_banco
            WHERE cb.id IS NULL
            """;

    private static final String SEED_NOME_GAP =
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
            WHERE cb.banco_nome IS NULL
            """;

    private static final String REBACKFILL =
            """
            UPDATE financeiro_lancamento fl
            JOIN conta_bancaria cb ON cb.numero_banco = fl.numero_banco
            SET fl.conta_bancaria_id = cb.id
            WHERE fl.conta_bancaria_id IS NULL AND fl.numero_banco IS NOT NULL
            """;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @Transactional
    void v117_seedDeBancoNovoEReBackfillFechamGapSemTocarNulos() {
        // banco NOVO (7777) sem conta: nome canônico = mais frequente não-nulo ('Banco Novo' 2x vs 'Alt' 1x)
        inserirLancamento(7777, "Banco Novo", "G-7a");
        inserirLancamento(7777, "Banco Novo", "G-7b");
        inserirLancamento(7777, "Alt", "G-7c");
        // numero_banco NULL: permanece sem FK
        inserirLancamento(null, "sem numero", "G-null");

        // estado de gap: nenhuma linha tem FK ainda (conta_bancaria_id default NULL)
        Integer gapAntes = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM financeiro_lancamento WHERE numero_banco IS NOT NULL AND conta_bancaria_id IS NULL",
                Integer.class);
        assertThat(gapAntes).isEqualTo(3);

        jdbcTemplate.update(SEED_GAP);
        jdbcTemplate.update(SEED_NOME_GAP);
        jdbcTemplate.update(REBACKFILL);

        // banco novo auto-semeado como REAL / com extrato e nome canônico
        assertThat(jdbcTemplate.queryForObject(
                "SELECT tipo FROM conta_bancaria WHERE numero_banco = 7777", String.class)).isEqualTo("REAL");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT tem_extrato FROM conta_bancaria WHERE numero_banco = 7777", Boolean.class)).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT banco_nome FROM conta_bancaria WHERE numero_banco = 7777", String.class)).isEqualTo("Banco Novo");

        // re-backfill fechou o gap: nenhuma linha com numero_banco fica sem FK
        Integer gapDepois = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM financeiro_lancamento WHERE numero_banco IS NOT NULL AND conta_bancaria_id IS NULL",
                Integer.class);
        assertThat(gapDepois).isZero();

        // numero_banco NULL não recebe FK
        Long fkDoNulo = jdbcTemplate.queryForObject(
                "SELECT conta_bancaria_id FROM financeiro_lancamento WHERE numero_lancamento = 'G-null'", Long.class);
        assertThat(fkDoNulo).isNull();

        // re-rodar é no-op (idempotente): não duplica conta nem altera o gap
        jdbcTemplate.update(SEED_GAP);
        jdbcTemplate.update(REBACKFILL);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM conta_bancaria WHERE numero_banco = 7777", Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM financeiro_lancamento WHERE numero_banco IS NOT NULL AND conta_bancaria_id IS NULL",
                Integer.class)).isZero();
    }

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
}
