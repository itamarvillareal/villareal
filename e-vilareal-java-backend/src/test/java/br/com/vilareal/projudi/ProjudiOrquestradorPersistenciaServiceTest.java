package br.com.vilareal.projudi;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjudiOrquestradorPersistenciaServiceTest {

    private static final ZoneId ZONA_BR = ZoneId.of("America/Sao_Paulo");

    @Mock
    private ProjudiPublicacaoTransacaoService publicacaoTransacaoService;

    @Mock
    private ProcessoRepository processoRepository;

    private ProjudiOrquestradorPersistenciaService service;

    @Test
    void atualizarProximaConsulta_usaClockBrasilia_naoUtcDaJvm() {
        // 2026-06-03 22:00 UTC = 2026-06-03 19:00 BRT — +6h => 2026-06-04 em Brasília
        Clock clock = Clock.fixed(Instant.parse("2026-06-03T22:00:00Z"), ZONA_BR);
        service = new ProjudiOrquestradorPersistenciaService(publicacaoTransacaoService, processoRepository, clock);

        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(99L);
        when(processoRepository.findById(99L)).thenReturn(Optional.of(processo));

        service.atualizarProximaConsulta(99L, 6);

        ArgumentCaptor<ProcessoEntity> cap = ArgumentCaptor.forClass(ProcessoEntity.class);
        verify(processoRepository).save(cap.capture());
        assertThat(cap.getValue().getProximaConsulta()).isEqualTo(LocalDate.of(2026, 6, 4));
    }
}
