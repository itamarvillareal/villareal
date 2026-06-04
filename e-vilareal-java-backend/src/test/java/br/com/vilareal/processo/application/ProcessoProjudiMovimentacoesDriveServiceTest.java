package br.com.vilareal.processo.application;

import br.com.vilareal.email.ProjudiMovimentacoesAcervoIntegralEstado;
import br.com.vilareal.processo.api.dto.ProcessoProjudiMovimentacoesDriveResponse;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiOrquestradorService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProcessoProjudiMovimentacoesDriveServiceTest {

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private ProjudiOrquestradorService orquestradorService;

    @Mock
    private ProjudiMovimentacoesAcervoIntegralEstado acervoIntegralEstado;

    @Test
    void executar_consultaProjudiMesmoComAcervoDesarmadoNoPipeline() {
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(42L);
        processo.setNumeroCnj("5161328-98.2023.8.09.0007");
        when(processoRepository.findByIdWithClienteAndPessoa(42L)).thenReturn(Optional.of(processo));

        var resultado = new ProjudiOrquestradorService.ResultadoSomenteDriveProcesso(
                processo.getNumeroCnj(),
                0,
                5,
                5,
                5,
                false,
                100L,
                null,
                List.of(),
                null);
        when(orquestradorService.executarSomenteDriveProgressivo(eq(1L), eq(processo), any()))
                .thenReturn(resultado);

        ProcessoProjudiMovimentacoesDriveService svc =
                new ProcessoProjudiMovimentacoesDriveService(processoRepository, orquestradorService, acervoIntegralEstado, 1L);
        ProcessoProjudiMovimentacoesDriveResponse resp = svc.executar(42L);

        verify(orquestradorService).executarSomenteDriveProgressivo(eq(1L), eq(processo), any(ArrayList.class));
        verify(acervoIntegralEstado).atualizarAposExecucaoDrive(42L, resultado);
        assertThat(resp.erro()).isNull();
        assertThat(resp.mensagem()).contains("já estão no Drive");
    }
}
