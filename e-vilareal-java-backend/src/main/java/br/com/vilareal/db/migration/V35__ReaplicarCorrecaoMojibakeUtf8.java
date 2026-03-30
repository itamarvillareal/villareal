package br.com.vilareal.db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Reaplica {@link MojibakeUtf8DadosRepair} após novos padrões em {@code Utf8MojibakeUtil} (idempotente). */
public class V35__ReaplicarCorrecaoMojibakeUtf8 extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        MojibakeUtf8DadosRepair.executar(context.getConnection());
    }
}
