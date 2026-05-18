package br.com.vilareal.db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * Reaplica normalização de texto (mojibake, U+FFFD, léxico jurídico) em processo, andamentos e tabelas correlatas.
 */
public class V51__normalizar_texto_historico_processos extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        MojibakeUtf8DadosRepair.executar(context.getConnection());
    }
}
