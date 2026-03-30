package br.com.vilareal.db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * Reaplica {@link MojibakeUtf8DadosRepair} após novos padrões em {@code Utf8MojibakeUtil} (idempotente).
 * Renumerada para 38 (antes V35) para não colidir com {@code V35__processo_utf8mb4.sql}.
 */
public class V38__ReaplicarCorrecaoMojibakeUtf8 extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        MojibakeUtf8DadosRepair.executar(context.getConnection());
    }
}
