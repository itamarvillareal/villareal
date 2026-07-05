package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.WhatsAppGrupoMaterializacaoResultDTO;
import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppGrupoMaterializacaoLockServiceTest {

    @Mock
    private LockingTaskExecutor lockingTaskExecutor;

    @Mock
    private WhatsAppGrupoMaterializacaoService materializacaoService;

    private WhatsAppGrupoMaterializacaoLockService lockService;

    @BeforeEach
    void setUp() {
        lockService = new WhatsAppGrupoMaterializacaoLockService(lockingTaskExecutor, materializacaoService);
    }

    @Test
    void lockIndisponivel_naoExecutaRodada() throws Throwable {
        @SuppressWarnings("unchecked")
        LockingTaskExecutor.TaskResult<WhatsAppGrupoMaterializacaoResultDTO> naoExecutado =
                org.mockito.Mockito.mock(LockingTaskExecutor.TaskResult.class);
        when(naoExecutado.wasExecuted()).thenReturn(false);
        when(lockingTaskExecutor.executeWithLock(
                        any(LockingTaskExecutor.TaskWithResult.class), any(LockConfiguration.class)))
                .thenReturn(naoExecutado);

        Optional<WhatsAppGrupoMaterializacaoResultDTO> result = lockService.executarRodadaComLock();

        assertThat(result).isEmpty();
        verify(materializacaoService, never()).executarRodada();
    }

    @Test
    void lockDisponivel_executaRodadaComMesmoNomeDoTick() throws Throwable {
        WhatsAppGrupoMaterializacaoResultDTO esperado = new WhatsAppGrupoMaterializacaoResultDTO(10, 5, 100L);
        @SuppressWarnings("unchecked")
        LockingTaskExecutor.TaskResult<WhatsAppGrupoMaterializacaoResultDTO> executado =
                org.mockito.Mockito.mock(LockingTaskExecutor.TaskResult.class);
        when(executado.wasExecuted()).thenReturn(true);
        when(executado.getResult()).thenReturn(esperado);
        when(lockingTaskExecutor.executeWithLock(
                        any(LockingTaskExecutor.TaskWithResult.class), any(LockConfiguration.class)))
                .thenAnswer(invocation -> {
                    LockingTaskExecutor.TaskWithResult<?> task = invocation.getArgument(0);
                    task.call();
                    return executado;
                });
        when(materializacaoService.executarRodada()).thenReturn(esperado);

        Optional<WhatsAppGrupoMaterializacaoResultDTO> result = lockService.executarRodadaComLock();

        assertThat(result).contains(esperado);

        ArgumentCaptor<LockConfiguration> lockCaptor = ArgumentCaptor.forClass(LockConfiguration.class);
        verify(lockingTaskExecutor)
                .executeWithLock(any(LockingTaskExecutor.TaskWithResult.class), lockCaptor.capture());
        assertThat(lockCaptor.getValue().getName()).isEqualTo(WhatsAppGrupoMaterializacaoLockService.LOCK_NAME);
    }
}
