package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleDriveServiceTest {

    @Test
    void sanitizarNomePasta_removeCaracteresInvalidos() {
        assertThat(GoogleDriveService.sanitizarNomePasta("00000854 - Maria/Silva"))
                .isEqualTo("00000854 - Maria Silva");
        assertThat(GoogleDriveService.sanitizarNomePasta(null)).isEqualTo("Sem Cliente");
    }

    @Test
    void sanitizarNomeArquivo_garanteExtensaoPdf() {
        assertThat(GoogleDriveService.sanitizarNomeArquivo("Procuracao - Maria"))
                .isEqualTo("Procuracao - Maria.pdf");
    }
}
