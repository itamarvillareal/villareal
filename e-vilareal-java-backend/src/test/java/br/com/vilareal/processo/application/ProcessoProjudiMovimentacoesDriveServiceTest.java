package br.com.vilareal.processo.application;

import br.com.vilareal.email.ProjudiMovimentacoesAcervoIntegralEstado;
import br.com.vilareal.processo.api.dto.ProcessoProjudiMovimentacoesDriveResponse;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiOrquestradorService;
import br.com.vilareal.projudi.ProjudiTeorService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProcessoProjudiMovimentacoesDriveServiceTest {

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private ProjudiOrquestradorService orquestradorService;

    @Mock
    private ProjudiTeorService teorService;

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
                null,
                null);
        when(orquestradorService.executarSomenteDriveProgressivo(eq(1L), eq(processo), any()))
                .thenReturn(resultado);
        when(teorService.consultarProcesso(1L, processo.getNumeroCnj()))
                .thenReturn(new ProjudiTeorService.ConsultaProcessoProjudi(List.of(), null));

        ProcessoProjudiMovimentacoesDriveService svc =
                new ProcessoProjudiMovimentacoesDriveService(
                        processoRepository, orquestradorService, teorService, acervoIntegralEstado, 1L);
        ProcessoProjudiMovimentacoesDriveResponse resp = svc.executar(42L);

        verify(orquestradorService).executarSomenteDriveProgressivo(eq(1L), eq(processo), any(ArrayList.class));
        verify(acervoIntegralEstado).atualizarAposExecucaoDrive(42L, resultado);
        assertThat(resp.erro()).isNull();
        assertThat(resp.mensagem()).contains("já estão no Drive");
    }

    @Test
    void executar_preencheDataProtocoloQuandoVazio() {
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(42L);
        processo.setNumeroCnj("5161328-98.2023.8.09.0007");
        when(processoRepository.findByIdWithClienteAndPessoa(42L)).thenReturn(Optional.of(processo));

        LocalDate dataDistribuicao = LocalDate.of(2024, 3, 20);
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
                null,
                dataDistribuicao);
        when(orquestradorService.executarSomenteDriveProgressivo(eq(1L), eq(processo), any()))
                .thenReturn(resultado);

        ProcessoProjudiMovimentacoesDriveService svc =
                new ProcessoProjudiMovimentacoesDriveService(
                        processoRepository, orquestradorService, teorService, acervoIntegralEstado, 1L);
        ProcessoProjudiMovimentacoesDriveResponse resp = svc.executar(42L);

        ArgumentCaptor<ProcessoEntity> captor = ArgumentCaptor.forClass(ProcessoEntity.class);
        verify(processoRepository).save(captor.capture());
        assertThat(captor.getValue().getDataProtocolo()).isEqualTo(dataDistribuicao);
        assertThat(resp.dataProtocolo()).isEqualTo(dataDistribuicao);
        assertThat(resp.mensagem()).contains("Data do protocolo preenchida");
        verify(teorService, never()).consultarProcesso(any(), any());
    }

    @Test
    void executar_buscaDataDistribuicaoNoCnjCompletoQuandoPassadaNaoExtraiu() {
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(42L);
        processo.setNumeroCnj("5196366-43.2024.8.09.0006");
        when(processoRepository.findByIdWithClienteAndPessoa(42L)).thenReturn(Optional.of(processo));

        LocalDate dataDistribuicao = LocalDate.of(2024, 3, 20);
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
                null,
                null);
        when(orquestradorService.executarSomenteDriveProgressivo(eq(1L), eq(processo), any()))
                .thenReturn(resultado);
        when(teorService.consultarProcesso(1L, processo.getNumeroCnj()))
                .thenReturn(new ProjudiTeorService.ConsultaProcessoProjudi(List.of(), dataDistribuicao));

        ProcessoProjudiMovimentacoesDriveService svc =
                new ProcessoProjudiMovimentacoesDriveService(
                        processoRepository, orquestradorService, teorService, acervoIntegralEstado, 1L);
        ProcessoProjudiMovimentacoesDriveResponse resp = svc.executar(42L);

        verify(teorService).consultarProcesso(1L, processo.getNumeroCnj());
        assertThat(resp.dataProtocolo()).isEqualTo(dataDistribuicao);
    }
}
