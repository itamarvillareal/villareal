package br.com.vilareal.processo.application;

import br.com.vilareal.pje.application.PjeCopiaIntegralPorProcessoService;
import br.com.vilareal.processo.api.dto.ProcessoMovimentacoesDriveResponse;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProcessoMovimentacoesDriveServiceTest {

    private static final String CNJ_TRT18 = "0000105-21.2025.5.18.0051";

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private ProcessoProjudiMovimentacoesDriveService projudiMovimentacoesDriveService;

    @Mock
    private PjeCopiaIntegralPorProcessoService pjeCopiaIntegralPorProcessoService;

    @Mock
    private ProcessoTramitacaoService processoTramitacaoService;

    @InjectMocks
    private ProcessoMovimentacoesDriveService service;

    @Test
    void executar_tramitacaoPje_disparaCopiaIntegralAssincrona() {
        ProcessoEntity processo = processo(CNJ_TRT18, "PJe");
        when(processoRepository.findByIdWithClienteAndPessoa(10L)).thenReturn(Optional.of(processo));

        ProcessoMovimentacoesDriveResponse r = service.executar(10L);

        assertThat(r.status()).isEqualTo("INICIADO");
        assertThat(r.tramitacao()).isEqualTo("PJe");
        verify(pjeCopiaIntegralPorProcessoService).dispararAssincrono(CNJ_TRT18);
        verify(processoTramitacaoService, never()).preencherSeVazioPorCnj(eq(10L), eq(CNJ_TRT18));
    }

    @Test
    void executar_tramitacaoVaziaCnjTrt18_disparaCopiaIntegralEPreencheTramitacao() {
        ProcessoEntity processo = processo(CNJ_TRT18, null);
        when(processoRepository.findByIdWithClienteAndPessoa(11L)).thenReturn(Optional.of(processo));

        ProcessoMovimentacoesDriveResponse r = service.executar(11L);

        assertThat(r.status()).isEqualTo("INICIADO");
        assertThat(r.tramitacao()).isEqualTo("PJe");
        verify(processoTramitacaoService).preencherSeVazioPorCnj(11L, CNJ_TRT18);
        verify(pjeCopiaIntegralPorProcessoService).dispararAssincrono(CNJ_TRT18);
        verify(projudiMovimentacoesDriveService, never()).executar(org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void executar_tramitacaoVaziaCnjTjgo_semSistema() {
        ProcessoEntity processo = processo("0001234-56.2024.8.09.0001", null);
        when(processoRepository.findByIdWithClienteAndPessoa(12L)).thenReturn(Optional.of(processo));

        ProcessoMovimentacoesDriveResponse r = service.executar(12L);

        assertThat(r.status()).isEqualTo("SEM_SISTEMA");
        verify(pjeCopiaIntegralPorProcessoService, never()).dispararAssincrono(org.mockito.ArgumentMatchers.anyString());
    }

    private static ProcessoEntity processo(String cnj, String tramitacao) {
        ProcessoEntity p = new ProcessoEntity();
        p.setNumeroCnj(cnj);
        p.setTramitacao(tramitacao);
        return p;
    }
}
