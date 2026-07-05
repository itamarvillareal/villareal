package br.com.vilareal.processo.application;

import br.com.vilareal.assinador.application.AssinaturaLoteService;
import br.com.vilareal.assinador.domain.AssinaturaLoteStatus;
import br.com.vilareal.assinador.infrastructure.persistence.entity.AssinaturaLoteEntity;
import br.com.vilareal.assinador.infrastructure.persistence.repository.AssinaturaLoteRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.processo.api.dto.AssinarAutomaticoResponse;
import br.com.vilareal.processo.api.dto.DiagnosticoAguardandoProtocoloItemRequest;
import br.com.vilareal.processo.api.dto.LoteAssinaturaStatusResponse;
import br.com.vilareal.processo.api.dto.PrepararAssinarResultado;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DiagnosticoAssinaturaAutomaticaServiceTest {

    private static final Long CREDENCIAL_ID = 42L;

    @Mock
    private DiagnosticoAguardandoProtocoloAssinarService diagnosticoAssinarService;

    @Mock
    private AssinaturaLoteService assinaturaLoteService;

    @Mock
    private AssinaturaLoteRepository assinaturaLoteRepository;

    private DiagnosticoAssinaturaAutomaticaService service;

    @BeforeEach
    void setUp() {
        service = new DiagnosticoAssinaturaAutomaticaService(
                diagnosticoAssinarService, assinaturaLoteService, assinaturaLoteRepository);
    }

    @Test
    void assinarAutomatico_preparaECriaLote() {
        List<DiagnosticoAguardandoProtocoloItemRequest> processos = List.of(item("12345678", 1));
        when(diagnosticoAssinarService.prepararAssinatura(CREDENCIAL_ID, processos))
                .thenReturn(new PrepararAssinarResultado(List.of(10L, 11L), List.of(), 3));
        when(assinaturaLoteRepository.findByStatusIn(anyList())).thenReturn(List.of());
        AssinaturaLoteEntity criado = lote(7L, AssinaturaLoteStatus.LIBERADO, List.of(10L, 11L));
        when(assinaturaLoteService.criarLote(List.of(10L, 11L), CREDENCIAL_ID)).thenReturn(criado);

        AssinarAutomaticoResponse resp = service.assinarAutomatico(CREDENCIAL_ID, processos);

        assertThat(resp.loteId()).isEqualTo(7L);
        assertThat(resp.peticaoIds()).containsExactly(10L, 11L);
        assertThat(resp.totalArquivos()).isEqualTo(3);
        assertThat(resp.loteReutilizado()).isFalse();
        verify(diagnosticoAssinarService).prepararAssinatura(CREDENCIAL_ID, processos);
        verify(assinaturaLoteService).criarLote(List.of(10L, 11L), CREDENCIAL_ID);
    }

    @Test
    void assinarAutomatico_cliqueDuplo_reutilizaLoteLiberadoSemCriarOutro() {
        List<DiagnosticoAguardandoProtocoloItemRequest> processos = List.of(item("12345678", 1));
        when(diagnosticoAssinarService.prepararAssinatura(CREDENCIAL_ID, processos))
                .thenReturn(new PrepararAssinarResultado(List.of(10L, 11L), List.of(), 3));
        AssinaturaLoteEntity existente = lote(5L, AssinaturaLoteStatus.LIBERADO, List.of(10L, 11L));
        when(assinaturaLoteRepository.findByStatusIn(List.of(AssinaturaLoteStatus.ERRO)))
                .thenReturn(List.of());
        when(assinaturaLoteRepository.findByStatusIn(List.of(AssinaturaLoteStatus.EM_ASSINATURA)))
                .thenReturn(List.of());
        when(assinaturaLoteRepository.findByStatusIn(List.of(AssinaturaLoteStatus.LIBERADO)))
                .thenReturn(List.of(existente));

        AssinarAutomaticoResponse resp = service.assinarAutomatico(CREDENCIAL_ID, processos);

        assertThat(resp.loteId()).isEqualTo(5L);
        assertThat(resp.loteReutilizado()).isTrue();
        verify(assinaturaLoteService, never()).criarLote(anyList(), any());
        verify(diagnosticoAssinarService).prepararAssinatura(CREDENCIAL_ID, processos);
    }

    @Test
    void assinarAutomatico_rejeitaQuandoEmAssinatura() {
        List<DiagnosticoAguardandoProtocoloItemRequest> processos = List.of(item("12345678", 1));
        when(diagnosticoAssinarService.prepararAssinatura(CREDENCIAL_ID, processos))
                .thenReturn(new PrepararAssinarResultado(List.of(10L), List.of(), 1));
        when(assinaturaLoteRepository.findByStatusIn(List.of(AssinaturaLoteStatus.ERRO)))
                .thenReturn(List.of());
        when(assinaturaLoteRepository.findByStatusIn(List.of(AssinaturaLoteStatus.EM_ASSINATURA)))
                .thenReturn(List.of(lote(3L, AssinaturaLoteStatus.EM_ASSINATURA, List.of(10L))));

        assertThatThrownBy(() -> service.assinarAutomatico(CREDENCIAL_ID, processos))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("em andamento")
                .hasMessageContaining("#3");
        verify(assinaturaLoteService, never()).criarLote(anyList(), any());
    }

    @Test
    void assinarAutomatico_rejeitaQuandoLoteErroExigeReliberar() {
        List<DiagnosticoAguardandoProtocoloItemRequest> processos = List.of(item("12345678", 1));
        when(diagnosticoAssinarService.prepararAssinatura(CREDENCIAL_ID, processos))
                .thenReturn(new PrepararAssinarResultado(List.of(10L), List.of(), 1));
        AssinaturaLoteEntity erro = lote(9L, AssinaturaLoteStatus.ERRO, List.of(10L));
        erro.setErroCodigo("TOKEN_OCUPADO");
        when(assinaturaLoteRepository.findByStatusIn(List.of(AssinaturaLoteStatus.ERRO)))
                .thenReturn(List.of(erro));

        assertThatThrownBy(() -> service.assinarAutomatico(CREDENCIAL_ID, processos))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Tentar novamente")
                .hasMessageContaining("#9");
        verify(assinaturaLoteService, never()).criarLote(anyList(), any());
    }

    @Test
    void consultarStatus_refleteTransicoes() {
        AssinaturaLoteEntity lote = lote(1L, AssinaturaLoteStatus.ERRO, List.of(10L));
        lote.setErroCodigo("TOKEN_OCUPADO");
        lote.setErroMensagem("Token bloqueado");
        when(assinaturaLoteService.buscarPorId(1L)).thenReturn(lote);

        LoteAssinaturaStatusResponse status = service.consultarStatus(1L);

        assertThat(status.status()).isEqualTo(AssinaturaLoteStatus.ERRO);
        assertThat(status.erroCodigo()).isEqualTo("TOKEN_OCUPADO");
        assertThat(status.mensagemUsuario()).isEqualTo("Token bloqueado");
    }

    @Test
    void consultarStatus_concluidoSemMensagemErro() {
        AssinaturaLoteEntity lote = lote(2L, AssinaturaLoteStatus.CONCLUIDO, List.of(20L));
        when(assinaturaLoteService.buscarPorId(2L)).thenReturn(lote);

        LoteAssinaturaStatusResponse status = service.consultarStatus(2L);

        assertThat(status.status()).isEqualTo(AssinaturaLoteStatus.CONCLUIDO);
        assertThat(status.mensagemUsuario()).isNull();
    }

    @Test
    void reliberar_voltaParaLiberado() {
        AssinaturaLoteEntity reliberado = lote(4L, AssinaturaLoteStatus.LIBERADO, List.of(10L));
        when(assinaturaLoteService.reliberarLote(4L)).thenReturn(reliberado);

        LoteAssinaturaStatusResponse status = service.reliberar(4L);

        assertThat(status.status()).isEqualTo(AssinaturaLoteStatus.LIBERADO);
        assertThat(status.erroCodigo()).isNull();
        verify(assinaturaLoteService).reliberarLote(4L);
    }

    @Test
    void assinarAutomatico_semPeticaoIdsAposPreparar_rejeita() {
        List<DiagnosticoAguardandoProtocoloItemRequest> processos = List.of(item("12345678", 1));
        when(diagnosticoAssinarService.prepararAssinatura(CREDENCIAL_ID, processos))
                .thenReturn(new PrepararAssinarResultado(List.of(), List.of(), 0));

        assertThatThrownBy(() -> service.assinarAutomatico(CREDENCIAL_ID, processos))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Nenhum PDF pendente");
        verify(assinaturaLoteService, never()).criarLote(anyList(), any());
    }

    @Test
    void assinarAutomatico_verificaOrdemIdempotencia_antesDeCriar() {
        List<DiagnosticoAguardandoProtocoloItemRequest> processos = List.of(item("12345678", 1));
        when(diagnosticoAssinarService.prepararAssinatura(CREDENCIAL_ID, processos))
                .thenReturn(new PrepararAssinarResultado(List.of(10L), List.of(), 1));
        when(assinaturaLoteRepository.findByStatusIn(anyList())).thenReturn(List.of());
        when(assinaturaLoteService.criarLote(anyList(), eq(CREDENCIAL_ID)))
                .thenReturn(lote(1L, AssinaturaLoteStatus.LIBERADO, List.of(10L)));

        service.assinarAutomatico(CREDENCIAL_ID, processos);

        ArgumentCaptor<List<AssinaturaLoteStatus>> captor = ArgumentCaptor.forClass(List.class);
        verify(assinaturaLoteRepository, org.mockito.Mockito.times(3)).findByStatusIn(captor.capture());
        assertThat(captor.getAllValues().get(0)).containsExactly(AssinaturaLoteStatus.ERRO);
        assertThat(captor.getAllValues().get(1)).containsExactly(AssinaturaLoteStatus.EM_ASSINATURA);
        assertThat(captor.getAllValues().get(2)).containsExactly(AssinaturaLoteStatus.LIBERADO);
    }

    private static DiagnosticoAguardandoProtocoloItemRequest item(String codigoCliente, int numeroInterno) {
        DiagnosticoAguardandoProtocoloItemRequest req = new DiagnosticoAguardandoProtocoloItemRequest();
        req.setCodigoCliente(codigoCliente);
        req.setNumeroInterno(numeroInterno);
        return req;
    }

    private static AssinaturaLoteEntity lote(Long id, AssinaturaLoteStatus status, List<Long> peticaoIds) {
        AssinaturaLoteEntity e = new AssinaturaLoteEntity();
        e.setId(id);
        e.setStatus(status);
        e.setPeticaoIds(peticaoIds);
        e.setCredencialId(CREDENCIAL_ID);
        return e;
    }
}
