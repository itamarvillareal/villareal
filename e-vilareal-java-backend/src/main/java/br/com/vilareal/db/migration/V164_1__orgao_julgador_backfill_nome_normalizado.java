package br.com.vilareal.db.migration;

import br.com.vilareal.localidade.domain.MunicipioTextoUtil;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/**
 * Backfill idempotente de {@code orgao_julgador.nome_normalizado} a partir de {@code nome},
 * usando a mesma normalização dos municípios (NFD, remove acentos, upper/trim).
 * Não faz nada se a tabela estiver vazia ou já estiver preenchida.
 */
public class V164_1__orgao_julgador_backfill_nome_normalizado extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection conn = context.getConnection();
        try (PreparedStatement sel = conn.prepareStatement(
                        "SELECT id, nome FROM orgao_julgador WHERE nome_normalizado IS NULL");
                ResultSet rs = sel.executeQuery();
                PreparedStatement upd = conn.prepareStatement(
                        "UPDATE orgao_julgador SET nome_normalizado = ? WHERE id = ?")) {
            int lote = 0;
            while (rs.next()) {
                long id = rs.getLong(1);
                String nome = rs.getString(2);
                upd.setString(1, MunicipioTextoUtil.normalizarNome(nome));
                upd.setLong(2, id);
                upd.addBatch();
                if (++lote % 500 == 0) {
                    upd.executeBatch();
                }
            }
            if (lote % 500 != 0) {
                upd.executeBatch();
            }
        }
    }
}
