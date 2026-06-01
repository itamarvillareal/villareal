package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiOrquestradorErroUtilTest {

    @Test
    void resumirFalhaUploadDrive_detectaQuotaServiceAccount() {
        List<String> detalhes = List.of(
                "5400529 | mov 13 | ERRO Drive: falha ao enviar doc.pdf (verifique permissões/quota do Google Drive).",
                "403 Forbidden POST ... \"reason\": \"storageQuotaExceeded\", \"message\": \"Service Accounts do not have storage quota\"");
        String msg = ProjudiOrquestradorErroUtil.resumirFalhaUploadDrive(detalhes);
        assertTrue(msg.contains("conta de serviço"));
        assertTrue(ProjudiOrquestradorErroUtil.detalhesIndicamFalhaUploadDrive(detalhes));
    }

    @Test
    void detalhesIndicamFalhaUploadDrive_falseQuandoVazio() {
        assertFalse(ProjudiOrquestradorErroUtil.detalhesIndicamFalhaUploadDrive(List.of()));
    }
}
