package br.com.vilareal.processo.application;

import br.com.vilareal.pje.application.PjeCopiaIntegralPorProcessoService;
import br.com.vilareal.pje.domain.PjeGrau;
import br.com.vilareal.pje.domain.PjeTribunal;
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
import static org.mockito.ArgumentMatchers.isNull;
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
    void executar_tramitacaoPjeTrt18_disparaComGrauSalvo() {
        ProcessoEntity processo = processo(CNJ_TRT18, "PJe", PjeTribunal.PJE_TRT18, PjeGrau.SEGUNDO_GRAU);
        when(processoRepository.findByIdWithClienteAndPessoa(10L)).thenReturn(Optional.of(processo));
        when(pjeCopiaIntegralPorProcessoService.validarDisparoAssincrono()).thenReturn(Optional.empty());

        ProcessoMovimentacoesDriveResponse r = service.executar(10L);

        assertThat(r.status()).isEqualTo("INICIADO");
        verify(pjeCopiaIntegralPorProcessoService)
                .dispararAssincrono(CNJ_TRT18, PjeGrau.SEGUNDO_GRAU);
    }

    @Test
    void executar_tramitacaoVaziaCnjTrt18_disparaFallback76639e9() {
        ProcessoEntity processo = processo(CNJ_TRT18, null, null, null);
        when(processoRepository.findByIdWithClienteAndPessoa(11L)).thenReturn(Optional.of(processo));
        when(pjeCopiaIntegralPorProcessoService.validarDisparoAssincrono()).thenReturn(Optional.empty());

        ProcessoMovimentacoesDriveResponse r = service.executar(11L);

        assertThat(r.status()).isEqualTo("INICIADO");
        verify(processoTramitacaoService).preencherSeVazioPorCnj(11L, CNJ_TRT18);
        verify(pjeCopiaIntegralPorProcessoService).dispararAssincrono(CNJ_TRT18, null);
    }

    @Test
    void executar_pjeAutoFreio_retornaFalhaImediata() {
        ProcessoEntity processo = processo(CNJ_TRT18, "PJe", PjeTribunal.PJE_TRT18, null);
        when(processoRepository.findByIdWithClienteAndPessoa(14L)).thenReturn(Optional.of(processo));
        when(pjeCopiaIntegralPorProcessoService.validarDisparoAssincrono())
                .thenReturn(Optional.of("Robô PJe TRT18 pausado"));

        ProcessoMovimentacoesDriveResponse r = service.executar(14L);

        assertThat(r.status()).isEqualTo("FALHA");
        assertThat(r.erro()).contains("pausado");
        verify(pjeCopiaIntegralPorProcessoService, never()).dispararAssincrono(org.mockito.ArgumentMatchers.anyString(), isNull());
    }

    @Test
    void executar_tramitacaoPjeTrf1_automacaoIndisponivel() {
        ProcessoEntity processo = processo("0001234-56.2024.4.01.0001", "PJe", PjeTribunal.PJE_TRF1, null);
        when(processoRepository.findByIdWithClienteAndPessoa(12L)).thenReturn(Optional.of(processo));

        ProcessoMovimentacoesDriveResponse r = service.executar(12L);

        assertThat(r.status()).isEqualTo("PJE_AUTOMACAO_INDISPONIVEL");
        verify(pjeCopiaIntegralPorProcessoService, never()).dispararAssincrono(org.mockito.ArgumentMatchers.anyString(), isNull());
    }

    @Test
    void executar_tramitacaoVaziaCnjTjgo_semSistema() {
        ProcessoEntity processo = processo("0001234-56.2024.8.09.0001", null, null, null);
        when(processoRepository.findByIdWithClienteAndPessoa(13L)).thenReturn(Optional.of(processo));

        ProcessoMovimentacoesDriveResponse r = service.executar(13L);

        assertThat(r.status()).isEqualTo("SEM_SISTEMA");
        verify(pjeCopiaIntegralPorProcessoService, never()).dispararAssincrono(eq(CNJ_TRT18), isNull());
    }

    private static ProcessoEntity processo(
            String cnj, String tramitacao, PjeTribunal pjeTribunal, PjeGrau pjeGrau) {
        ProcessoEntity p = new ProcessoEntity();
        p.setNumeroCnj(cnj);
        p.setTramitacao(tramitacao);
        p.setPjeTribunal(pjeTribunal);
        p.setPjeGrau(pjeGrau);
        return p;
    }
}
