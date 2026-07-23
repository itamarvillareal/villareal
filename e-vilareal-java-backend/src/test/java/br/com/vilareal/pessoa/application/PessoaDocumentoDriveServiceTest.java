package br.com.vilareal.pessoa.application;

import br.com.vilareal.documento.DriveArquivoDto;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PessoaDocumentoDriveServiceTest {

    @Test
    void ehArquivoP7s_reconheceExtensaoEMime() {
        assertThat(PessoaDocumentoDriveService.ehArquivoP7s(
                        new DriveArquivoDto("1", "02. Contrato.p7s", null, "application/pkcs7-signature", null, null, null, null, null)))
                .isTrue();
        assertThat(PessoaDocumentoDriveService.ehArquivoP7s(
                        new DriveArquivoDto("2", "doc.pdf", null, "application/pdf", null, null, null, null, null)))
                .isFalse();
        assertThat(PessoaDocumentoDriveService.ehArquivoP7s(null)).isFalse();
    }
}
