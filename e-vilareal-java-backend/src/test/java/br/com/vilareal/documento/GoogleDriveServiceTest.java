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

    @Test
    void formatarNomePastaPessoa_usaIdENome() {
        assertThat(DocumentoDrivePastaService.formatarNomePastaPessoa(42L, "Maria Silva"))
                .isEqualTo("00000042 - Maria Silva");
        assertThat(DocumentoDrivePastaService.formatarNomePastaPessoa(668L, "Empresa LTDA"))
                .isEqualTo("00000668 - Empresa LTDA");
    }

    @Test
    void pastasTipoDocumentoPessoa_incluiAssinados() {
        assertThat(DocumentoDrivePastaService.pastasTipoDocumentoPessoa())
                .contains("Documentos", "Procurações", "Contratos", "Declarações", "Assinados");
    }
}
