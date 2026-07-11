package br.com.vilareal.agenda;

import br.com.vilareal.agenda.application.ProcessoAudienciaAgendaSyncScheduler;
import br.com.vilareal.agenda.application.ProcessoAudienciaAgendaSyncService;
import br.com.vilareal.jobrun.application.JobRunContext;
import br.com.vilareal.jobrun.application.JobRunTracker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProcessoAudienciaAgendaSyncSchedulerTest {

    @Mock
    private ProcessoAudienciaAgendaSyncService syncService;

    @Mock
    private JobRunTracker jobRunTracker;

    @Mock
    private JobRunContext jobRunContext;

    private ProcessoAudienciaAgendaSyncScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new ProcessoAudienciaAgendaSyncScheduler(syncService, jobRunTracker, true);
    }

    @Test
    void tick_desabilitado_naoExecutaBackfill() {
        scheduler = new ProcessoAudienciaAgendaSyncScheduler(syncService, jobRunTracker, false);
        scheduler.tick();
        verify(jobRunTracker, never()).runTrackedJobVoid(any(), any());
    }

    @Test
    void tick_habilitado_executaBackfill() {
        when(syncService.backfillTodosAtivosComAudiencia())
                .thenReturn(new ProcessoAudienciaAgendaSyncService.BackfillResult(10, 30, 2, 0));
        doAnswer(inv -> {
            inv.getArgument(1, java.util.function.Consumer.class).accept(jobRunContext);
            return null;
        })
                .when(jobRunTracker)
                .runTrackedJobVoid(any(), any());

        scheduler.tick();

        verify(syncService).backfillTodosAtivosComAudiencia();
    }
}
