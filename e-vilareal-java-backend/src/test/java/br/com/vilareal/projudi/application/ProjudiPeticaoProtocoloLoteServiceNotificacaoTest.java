package br.com.vilareal.projudi.application;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ProjudiPeticaoProtocoloLoteServiceNotificacaoTest {

    @Mock private ProjudiPeticaoProtocoloEmailService protocoloEmailService;

    @InjectMocks private ProjudiPeticaoProtocoloLoteService loteService;

    @Test
    void notificarResultadosPorEmail_enviaSucessoQuandoTodasProtocoladas() {
        loteService.notificarResultadosPorEmail(List.of(
                new ProjudiPeticaoProtocoloLoteService.ResultadoItemLote(
                        1L, "5289982-04.2026.8.09.0005", ProjudiPeticaoProtocoloLoteService.RESULTADO_PROTOCOLADA, "OK PROJUDI"),
                new ProjudiPeticaoProtocoloLoteService.ResultadoItemLote(
                        2L, "5289982-04.2026.8.09.0005", ProjudiPeticaoProtocoloLoteService.RESULTADO_PROTOCOLADA, "OK PROJUDI")));

        verify(protocoloEmailService)
                .notificarSucessoProtocolo(eq("5289982-04.2026.8.09.0005"), eq(List.of(1L, 2L)), eq("OK PROJUDI"));
        verify(protocoloEmailService, never()).notificarErroProtocolo(any(), any(), any());
    }

    @Test
    void notificarResultadosPorEmail_enviaErroQuandoAlgumaFalha() {
        loteService.notificarResultadosPorEmail(List.of(new ProjudiPeticaoProtocoloLoteService.ResultadoItemLote(
                82L, "5289982-04.2026.8.09.0005", ProjudiPeticaoProtocoloLoteService.RESULTADO_ERRO, ".p7s não encontrado")));

        ArgumentCaptor<String> msgCap = ArgumentCaptor.forClass(String.class);
        verify(protocoloEmailService)
                .notificarErroProtocolo(eq("5289982-04.2026.8.09.0005"), eq(List.of(82L)), msgCap.capture());
        assertThat(msgCap.getValue()).contains(".p7s não encontrado");
    }
}
