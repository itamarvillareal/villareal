package br.com.vilareal.agenda;

import br.com.vilareal.agenda.application.ProcessoAudienciaAgendaSyncService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Runner manual: espelha todas as audiências dos processos na agenda.
 * {@code ./mvnw test -Dtest=ProcessoAudienciaAgendaBackfillRunnerTest}
 */
@SpringBootTest
@ActiveProfiles("dev")
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
