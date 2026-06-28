package br.com.vilareal.db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Popula estado/município a partir de seeds/municipios-ibge.json (idempotente). */
public class V161_1__localidade_seed_ibge extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        IbgeSeedSupport.executar(context.getConnection());
    }
}
