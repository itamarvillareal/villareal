package br.com.vilareal.db.migration;

import br.com.vilareal.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Valida o BACKFILL do V118 (fonte única imóvel↔processo, FASE A) em MySQL real.
 *
 * <p>Reexecuta o SQL idempotente do V118 sobre dados representativos: um imóvel com escalar
 * processo_id SEM linha em imovel_processo (o divergente que o backfill fecha) e um imóvel que já tem
 * linha ativa (não pode duplicar). Prova que (a) o divergente passa a ter uma linha ATIVA com o
 * mesmo processo do escalar e (b) re-rodar não duplica (NOT EXISTS no par + UK).
 */
class V118ImovelProcessoBackfillIntegrationTest extends AbstractIntegrationTest {

    private static final String BACKFILL =
            """
            INSERT INTO imovel_processo (imovel_id, processo_id, data_inicio, ativo)
            SELECT i.id, i.processo_id, NULL, TRUE
            FROM imovel i
            WHERE i.processo_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM imovel_processo ip
                  WHERE ip.imovel_id = i.id AND ip.processo_id = i.processo_id
              )
            """;

    private static final AtomicInteger SEQ = new AtomicInteger(1);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @Transactional
    void v118_backfillFechaDivergenteSemDuplicarOExistente() {
        long pessoaId = inserirPessoa();
        long procA = inserirProcesso(pessoaId, 1001);
        long procB = inserirProcesso(pessoaId, 1002);

        // imóvel A: escalar aponta p/ procA, SEM linha imovel_processo (divergente)
        long imovelA = inserirImovel(pessoaId, procA);
        // imóvel B: escalar aponta p/ procB E já tem linha ATIVA correspondente
        long imovelB = inserirImovel(pessoaId, procB);
        jdbcTemplate.update(
                "INSERT INTO imovel_processo (imovel_id, processo_id, ativo) VALUES (?, ?, TRUE)", imovelB, procB);

        assertThat(contarLinhas(imovelA)).isZero();
        assertThat(contarLinhas(imovelB)).isEqualTo(1);

        jdbcTemplate.update(BACKFILL);

        // A: agora tem 1 linha ATIVA com o processo do escalar
        assertThat(contarAtivas(imovelA)).isEqualTo(1);
        Long procAtivoA = jdbcTemplate.queryForObject(
                "SELECT processo_id FROM imovel_processo WHERE imovel_id = ? AND ativo = TRUE", Long.class, imovelA);
        assertThat(procAtivoA).isEqualTo(procA);

        // B: não duplicou
        assertThat(contarLinhas(imovelB)).isEqualTo(1);

        // divergência fechada: nenhum imóvel com escalar não-nulo sem linha p/ o par
        assertThat(escalarSemPar()).isZero();

        // idempotente: re-rodar não cria nada
        jdbcTemplate.update(BACKFILL);
        assertThat(contarLinhas(imovelA)).isEqualTo(1);
        assertThat(contarLinhas(imovelB)).isEqualTo(1);
        assertThat(escalarSemPar()).isZero();
    }

    private Integer contarLinhas(long imovelId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM imovel_processo WHERE imovel_id = ?", Integer.class, imovelId);
    }

    private Integer contarAtivas(long imovelId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM imovel_processo WHERE imovel_id = ? AND ativo = TRUE", Integer.class, imovelId);
    }

    private Integer escalarSemPar() {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM imovel i WHERE i.processo_id IS NOT NULL AND NOT EXISTS ("
                        + "SELECT 1 FROM imovel_processo ip WHERE ip.imovel_id = i.id AND ip.processo_id = i.processo_id)",
                Integer.class);
    }

    private long inserirPessoa() {
        int n = SEQ.getAndIncrement();
        jdbcTemplate.update(
                "INSERT INTO pessoa (nome, cpf) VALUES (?, ?)", "Teste V118 " + n, "v118-" + n);
        return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }

    private long inserirProcesso(long pessoaId, int numeroInterno) {
        jdbcTemplate.update(
                "INSERT INTO processo (pessoa_id, numero_interno) VALUES (?, ?)", pessoaId, numeroInterno);
        return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }

    private long inserirImovel(long pessoaId, Long processoId) {
        jdbcTemplate.update(
                "INSERT INTO imovel (pessoa_id, processo_id) VALUES (?, ?)", pessoaId, processoId);
        return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }
}
