package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjudiPeticaoServiceSessaoTest {

    @Mock
    private ProjudiSessionService sessionService;

    @InjectMocks
    private ProjudiPeticaoService peticaoService;

    @Test
    void fluxoProtocolo_invalidaSessaoQuandoFalhaOtp() {
        when(sessionService.buscarProcessoConsulta(anyLong(), anyString()))
                .thenThrow(new IllegalStateException("Token OTP não recebido no prazo."));

        peticaoService.protocolarPeticao(
                1L,
                "5036755-28.2024.8.09.0047",
                "",
                List.of(new ProjudiPeticaoService.ArquivoPeticao(new byte[] {1}, 16, "doc.pdf.p7s")));

        verify(sessionService).invalidarSessao(1L);
    }

    @Test
    void validacaoSemConcluir_naoInvalidaSessaoAoTerminar() {
        when(sessionService.buscarProcessoConsulta(anyLong(), anyString()))
                .thenThrow(new RuntimeException("falha simulada"));

        peticaoService.validarProtocoloSemConcluir(
                1L,
                "5036755-28.2024.8.09.0047",
                "",
                List.of(new ProjudiPeticaoService.ArquivoPeticao(new byte[] {1}, 16, "doc.pdf.p7s")));

        verify(sessionService, never()).invalidarSessao(anyLong());
    }

    @Test
    void protocoloComConcluir_falhaGenerica_naoInvalidaSessao() {
        when(sessionService.buscarProcessoConsulta(anyLong(), anyString()))
                .thenThrow(new IllegalStateException("falha simulada"));

        peticaoService.protocolarPeticao(
                1L,
                "5036755-28.2024.8.09.0047",
                "",
                List.of(new ProjudiPeticaoService.ArquivoPeticao(new byte[] {1}, 16, "doc.pdf.p7s")));

        verify(sessionService, never()).invalidarSessao(anyLong());
    }

    @Test
    void deveInvalidarSessaoPosProtocolo_sucesso_mantemSessao() {
        var ok = new ProjudiPeticaoService.ResultadoProtocoloPeticao(true, "Petição enviada com sucesso.", "");
        assertFalse(ProjudiPeticaoService.deveInvalidarSessaoPosProtocolo(ok));
    }

    @Test
    void deveInvalidarSessaoPosProtocolo_pedidoDuplicado_descartaSessao() {
        var erro = new ProjudiPeticaoService.ResultadoProtocoloPeticao(
                false,
                "Passo 11 falhou.",
                "pedido enviado mais de uma vez");
        assertTrue(ProjudiPeticaoService.deveInvalidarSessaoPosProtocolo(erro));
    }

    @Test
    void deveInvalidarSessaoPosProtocolo_telaLogin_descartaSessao() {
        var erro = new ProjudiPeticaoService.ResultadoProtocoloPeticao(
                false,
                "Passo 1 falhou.",
                "<form id=\"formLogin\" name=\"usuario\" name=\"senha\">");
        assertTrue(ProjudiPeticaoService.deveInvalidarSessaoPosProtocolo(erro));
    }

    @Test
    void deveInvalidarSessaoPosProtocolo_falhaConcluirSemSinal_mantemSessao() {
        var erro = new ProjudiPeticaoService.ResultadoProtocoloPeticao(
                false,
                "Passo 11 (Concluir) não confirmou sucesso.",
                "location=\n<html>erro genérico</html>");
        assertFalse(ProjudiPeticaoService.deveInvalidarSessaoPosProtocolo(erro));
    }
}
