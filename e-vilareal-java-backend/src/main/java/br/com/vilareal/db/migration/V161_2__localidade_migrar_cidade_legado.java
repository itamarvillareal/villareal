package br.com.vilareal.db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Backfill municipio_id a partir de cidade/UF legado; gera CSV de pendências. */
public class V161_2__localidade_migrar_cidade_legado extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        CidadeLegadoMigracaoSupport.executar(context.getConnection());
    }
}
