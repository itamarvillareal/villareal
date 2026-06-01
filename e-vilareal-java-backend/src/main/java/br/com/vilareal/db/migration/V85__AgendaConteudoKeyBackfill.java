package br.com.vilareal.db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * V85 — coluna {@code conteudo_key}, backfill com {@link br.com.vilareal.agenda.application.AgendaConteudoKeyService}
 * (mesma lógica do runtime), dedup exato por chave (menor id), NOT NULL e UNIQUE.
 *
 * <p>Idempotente: cada passo verifica estado atual (coluna, nullable, índice) antes de alterar.
 * Não faz DROP de coluna — seguro em base já populada.
 */
public class V85__AgendaConteudoKeyBackfill extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        AgendaConteudoKeyMigrationHelper.executar(context.getConnection());
    }
}
