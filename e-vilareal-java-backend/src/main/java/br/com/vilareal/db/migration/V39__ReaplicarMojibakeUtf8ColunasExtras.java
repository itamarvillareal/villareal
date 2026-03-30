package br.com.vilareal.db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * Reaplica {@link MojibakeUtf8DadosRepair} após ampliação para todas as colunas de texto relevantes
 * (UF, JSON, usuários, perfil, financeiro, tarefas, tópicos, cálculos, etc.) — idempotente.
 * Renumerada para 39 (antes V36) para não colidir com {@code V36__seed_demo_pessoas_clientes_processos.sql}.
 */
public class V39__ReaplicarMojibakeUtf8ColunasExtras extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        MojibakeUtf8DadosRepair.executar(context.getConnection());
    }
}
