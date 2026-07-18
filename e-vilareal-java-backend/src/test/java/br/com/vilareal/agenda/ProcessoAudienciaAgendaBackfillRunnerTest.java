package br.com.vilareal.agenda;

import br.com.vilareal.agenda.application.ProcessoAudienciaAgendaSyncService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Runner manual (requer banco dev — não roda no CI): espelha todas as audiências dos processos na agenda.
 * {@code ./mvnw test -Dtest=ProcessoAudienciaAgendaBackfillRunnerTest -Dvilareal.agenda.runner=true}
 */
@SpringBootTest
@ActiveProfiles("dev")
@EnabledIfSystemProperty(named = "vilareal.agenda.runner", matches = "true")
class ProcessoAudienciaAgendaBackfillRunnerTest {

    @Autowired
    private ProcessoAudienciaAgendaSyncService syncService;

    @Test
    void backfillTodasAudienciasProcessosNaAgenda() {
        var r = syncService.backfillTodosAtivosComAudiencia();
        System.out.printf(
                "BACKFILL audiências → agenda: processos=%d colaboradores=%d removidos=%d falhas=%d%n",
                r.processosProcessados(),
                r.colaboradoresSincronizados(),
                r.eventosRemovidos(),
                r.falhas());
    }
}
