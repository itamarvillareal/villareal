package br.com.vilareal.agenda;

import br.com.vilareal.agenda.application.ProcessoAudienciaAgendaSyncService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** Reparo pontual: {@code ./mvnw test -Dtest=ProcessoAudienciaAgendaSyncOneRunnerTest -Dsync.processoId=8514} */
@SpringBootTest
@ActiveProfiles("dev")
class ProcessoAudienciaAgendaSyncOneRunnerTest {

    @Autowired
    private ProcessoAudienciaAgendaSyncService syncService;

    @Test
    void sincronizarUmProcesso() {
        String raw = System.getProperty("sync.processoId", "8514");
        long id = Long.parseLong(raw);
        var r = syncService.sincronizarProcessoIsolado(id);
        System.out.printf("SYNC processoId=%d colaboradores=%d removidos=%d%n", id, r.colaboradoresSincronizados(), r.eventosRemovidos());
    }
}
