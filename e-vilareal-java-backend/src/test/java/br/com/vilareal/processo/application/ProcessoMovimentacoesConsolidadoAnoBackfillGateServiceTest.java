package br.com.vilareal.processo.application;

import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.jobrun.infrastructure.persistence.repository.JobRunRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProcessoMovimentacoesConsolidadoAnoBackfillGateServiceTest {

    @Mock
    private JobRunRepository jobRunRepository;

    @InjectMocks
    private ProcessoMovimentacoesConsolidadoAnoBackfillGateService gate;

    @Test
    void jaConcluidoComSucesso_quandoExisteJobSuccessNoBanco() {
        when(jobRunRepository.countConsolidadoAnoBackfillConcluido(JobNames.CONSOLIDADO_DRIVE_BACKFILL, 2026))
                .thenReturn(1L);

        assertTrue(gate.jaConcluidoComSucesso(2026));
    }

    @Test
    void jaConcluidoComSucesso_falseParaAnoInvalido() {
        assertFalse(gate.jaConcluidoComSucesso(0));
        verifyNoInteractions(jobRunRepository);
    }
}
