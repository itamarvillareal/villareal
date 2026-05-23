package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoDrivePastaServiceTest {

    @Test
    void formatarNomePastaProcesso_usaDoisDigitos() {
        assertThat(DocumentoDrivePastaService.formatarNomePastaProcesso(1)).isEqualTo("Proc. 01");
        assertThat(DocumentoDrivePastaService.formatarNomePastaProcesso(12)).isEqualTo("Proc. 12");
        assertThat(DocumentoDrivePastaService.formatarNomePastaProcesso(null)).isEqualTo("Proc. 00");
    }

    @Test
    void formatarNomePastaParteOposta_normalizaNome() {
        assertThat(DocumentoDrivePastaService.formatarNomePastaParteOposta("BEATRIZ MEDEIROS CINTRA"))
                .isEqualTo("Beatriz Medeiros Cintra");
    }
}
