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
    void formatarNomePastaParteOposta_multiplosReus_normalizaPrimeiroEOutros() {
        assertThat(DocumentoDrivePastaService.formatarNomePastaParteOposta(
                        "FERNANDO MACHADO GUIMARAES e outros"))
                .isEqualTo("Fernando Machado Guimaraes e Outros");
    }

    @Test
    void formatarNomePastaImovel_usaNumeroPlanilhaEUnidade() {
        assertThat(DocumentoDrivePastaService.formatarNomePastaImovel(43, "Unidade 1101 C", "Veredas do Bosque"))
                .isEqualTo("43 - Unidade 1101 C");
        assertThat(DocumentoDrivePastaService.formatarNomePastaImovel(2, null, "Avenida Parque"))
                .isEqualTo("2 - Avenida Parque");
    }

    @Test
    void formatarNomePastaParteOposta_normalizaNome() {
        assertThat(DocumentoDrivePastaService.formatarNomePastaParteOposta("BEATRIZ MEDEIROS CINTRA"))
                .isEqualTo("Beatriz Medeiros Cintra");
    }
}
