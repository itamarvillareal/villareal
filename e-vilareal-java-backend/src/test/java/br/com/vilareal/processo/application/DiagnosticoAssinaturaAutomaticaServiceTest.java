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
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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
                diagnosticoAssinarService, assinaturaLoteService, assinaturaLoteRepository, new ObjectMapper());
    }

    @Test
    void assinarAutomatico_criaLotePreparandoERetornaImediato() {
        List<DiagnosticoAguardandoProtocoloItemRequest> processos = List.of(item("12345678", 1));
        when(assinaturaLoteRepository.findByStatusAndCredencialIdOrderByCriadoEmDesc(
                        AssinaturaLoteStatus.PREPARANDO, CREDENCIAL_ID))
                .thenReturn(List.of());
        when(assinaturaLoteRepository.findByStatusIn(List.of(AssinaturaLoteStatus.EM_ASSINATURA)))
                .thenReturn(List.of());
        AssinaturaLoteEntity criado = lote(7L, AssinaturaLoteStatus.PREPARANDO, List.of());
        when(assinaturaLoteService.criarLoteEmPreparacao(eq(CREDENCIAL_ID), any())).thenReturn(criado);

        AssinarAutomaticoResponse resp = service.assinarAutomatico(CREDENCIAL_ID, processos);

        assertThat(resp.loteId()).isEqualTo(7L);
        assertThat(resp.peticaoIds()).isEmpty();
        assertThat(resp.totalArquivos()).isZero();
        verify(assinaturaLoteService).criarLoteEmPreparacao(eq(CREDENCIAL_ID), any());
        verify(assinaturaLoteService, never()).criarLote(any(), any());
    }

    @Test
    void executarPreparoEmBackground_concluiPreparacao() {
        List<DiagnosticoAguardandoProtocoloItemRequest> processos = List.of(item("12345678", 1));
        when(diagnosticoAssinarService.prepararAssinatura(CREDENCIAL_ID, processos))
                .thenReturn(new PrepararAssinarResultado(List.of(10L, 11L), List.of(), 3));
        when(assinaturaLoteRepository.findByStatusIn(any())).thenReturn(List.of());

        service.executarPreparoEmBackground(7L, CREDENCIAL_ID, processos);

        verify(assinaturaLoteService).concluirPreparacao(7L, List.of(10L, 11L), 3);
    }

    @Test
    void executarPreparoEmBackground_falhaQuandoSemPdf() {
        List<DiagnosticoAguardandoProtocoloItemRequest> processos = List.of(item("12345678", 1));
        when(diagnosticoAssinarService.prepararAssinatura(CREDENCIAL_ID, processos))
                .thenReturn(new PrepararAssinarResultado(List.of(), List.of(), 0));

        service.executarPreparoEmBackground(8L, CREDENCIAL_ID, processos);

        verify(assinaturaLoteService).falharPreparacao(eq(8L), eq("PREPARO_VAZIO"), any());
    }

    @Test
    void assinarAutomatico_cliqueDuplo_reutilizaPreparandoEmAndamento() {
        List<DiagnosticoAguardandoProtocoloItemRequest> processos = List.of(item("12345678", 1));
        AssinaturaLoteEntity existente = lote(5L, AssinaturaLoteStatus.PREPARANDO, List.of());
        existente.setResultadoJson(new ObjectMapper().createObjectNode().put("fingerprint", "12345678|1|null;"));
        when(assinaturaLoteRepository.findByStatusAndCredencialIdOrderByCriadoEmDesc(
                        AssinaturaLoteStatus.PREPARANDO, CREDENCIAL_ID))
                .thenReturn(List.of(existente));

        AssinarAutomaticoResponse resp = service.assinarAutomatico(CREDENCIAL_ID, processos);

        assertThat(resp.loteId()).isEqualTo(5L);
        assertThat(resp.loteReutilizado()).isTrue();
        verify(assinaturaLoteService, never()).criarLoteEmPreparacao(any(), any());
    }

    @Test
    void assinarAutomatico_rejeitaQuandoEmAssinatura() {
        List<DiagnosticoAguardandoProtocoloItemRequest> processos = List.of(item("12345678", 1));
        when(assinaturaLoteRepository.findByStatusAndCredencialIdOrderByCriadoEmDesc(
                        AssinaturaLoteStatus.PREPARANDO, CREDENCIAL_ID))
                .thenReturn(List.of());
        AssinaturaLoteEntity emAssinatura = lote(3L, AssinaturaLoteStatus.EM_ASSINATURA, List.of(10L));
        when(assinaturaLoteRepository.findByStatusIn(List.of(AssinaturaLoteStatus.EM_ASSINATURA)))
                .thenReturn(List.of(emAssinatura));

        assertThatThrownBy(() -> service.assinarAutomatico(CREDENCIAL_ID, processos))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("em andamento");
    }

    @Test
    void assinarAutomatico_naoBloqueiaPorLoteErroAnterior() {
        List<DiagnosticoAguardandoProtocoloItemRequest> processos = List.of(item("12345678", 1));
        when(assinaturaLoteRepository.findByStatusAndCredencialIdOrderByCriadoEmDesc(
                        AssinaturaLoteStatus.PREPARANDO, CREDENCIAL_ID))
                .thenReturn(List.of());
        when(assinaturaLoteRepository.findByStatusIn(List.of(AssinaturaLoteStatus.EM_ASSINATURA)))
                .thenReturn(List.of());
        when(assinaturaLoteService.criarLoteEmPreparacao(eq(CREDENCIAL_ID), any()))
                .thenReturn(lote(11L, AssinaturaLoteStatus.PREPARANDO, List.of()));

        AssinarAutomaticoResponse resp = service.assinarAutomatico(CREDENCIAL_ID, processos);

        assertThat(resp.loteId()).isEqualTo(11L);
        verify(assinaturaLoteService).criarLoteEmPreparacao(eq(CREDENCIAL_ID), any());
    }

    @Test
    void consultarStatus_preparando() {
        when(assinaturaLoteService.buscarPorId(2L))
                .thenReturn(lote(2L, AssinaturaLoteStatus.PREPARANDO, List.of()));

        LoteAssinaturaStatusResponse status = service.consultarStatus(2L);

        assertThat(status.status()).isEqualTo(AssinaturaLoteStatus.PREPARANDO);
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
