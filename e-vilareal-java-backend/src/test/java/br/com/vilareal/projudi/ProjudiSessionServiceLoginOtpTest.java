package br.com.vilareal.projudi;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiSessionServiceLoginOtpTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void mensagemFalhaLoginOtp_usaMensagemDoTribunalComHorario() throws Exception {
        ObjectNode login = mapper.createObjectNode();
        login.put("sucesso", false);
        login.put("requerOtp", true);
        login.put(
                "mensagem",
                "O limite de envios do código de segurança foi atingido. "
                        + "Um novo poderá ser solicitado a partir das 18:18.");
        login.put("proximoEnvioDisponivelMilissegundos", 1_784_841_529_000L);

        String msg = ProjudiSessionService.mensagemFalhaLoginOtp(login);

        assertTrue(msg.contains("limite de envios"));
        assertTrue(msg.contains("18:18"));
        // já tem horário na mensagem — não duplica
        assertEquals(1, msg.split("18:18", -1).length - 1);
    }

    @Test
    void mensagemFalhaLoginOtp_anexaHorarioQuandoMensagemNaoTem() throws Exception {
        ObjectNode login = mapper.createObjectNode();
        login.put("sucesso", false);
        login.put("requerOtp", true);
        login.put("mensagem", "O limite de envios do código de segurança foi atingido.");
        // 2026-07-23 18:18:49 BRT
        login.put("proximoEnvioDisponivelMilissegundos", 1_784_841_529_000L);

        String msg = ProjudiSessionService.mensagemFalhaLoginOtp(login);

        assertTrue(msg.contains("limite de envios"));
        assertTrue(msg.contains("18:18"));
        assertTrue(msg.contains("Tente novamente a partir das"));
    }

    @Test
    void mensagemFalhaLoginOtp_montaMensagemSoComMillis() {
        ObjectNode login = mapper.createObjectNode();
        login.put("proximoEnvioDisponivelMilissegundos", 1_784_841_529_000L);

        String msg = ProjudiSessionService.mensagemFalhaLoginOtp(login);

        assertTrue(msg.contains("limite de envios"));
        assertTrue(msg.contains("18:18"));
    }

    @Test
    void isFalhaAutenticacaoProjudi_reconheceLimiteOtp() {
        assertTrue(ProjudiSessionService.isFalhaAutenticacaoProjudi(
                "O limite de envios do código de segurança foi atingido. "
                        + "Um novo poderá ser solicitado a partir das 18:18."));
        assertTrue(ProjudiSessionService.isFalhaAutenticacaoProjudi("Token OTP não recebido no prazo."));
        assertFalse(ProjudiSessionService.isFalhaAutenticacaoProjudi("Bairro não encontrado no PROJUDI."));
    }
}
