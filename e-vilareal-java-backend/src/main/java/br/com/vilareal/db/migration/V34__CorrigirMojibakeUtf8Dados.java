package br.com.vilareal.db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * Corrige texto UTF-8 corrompido (mojibake) já persistido, usando a mesma lógica da API
 * ({@link br.com.vilareal.common.text.Utf8MojibakeUtil#corrigir}).
 */
public class V34__CorrigirMojibakeUtf8Dados extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        MojibakeUtf8DadosRepair.executar(context.getConnection());
    }
}
