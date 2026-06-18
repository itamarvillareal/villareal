package br.com.vilareal.projudi.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProjudiPeticaoAssinaturaRefCanonicaTest {

    @Test
    void parseRefCanonicaDoNome_extraiPeticaoOrdemSha8() {
        var ref = ProjudiPeticaoAssinaturaService.parseRefCanonicaDoNome("23_9_d11d6b57.pdf.p7s");
        assertThat(ref).isPresent();
        assertThat(ref.get().peticaoId()).isEqualTo(23L);
        assertThat(ref.get().ordem()).isEqualTo(9);
        assertThat(ref.get().sha8()).isEqualTo("d11d6b57");
    }

    @Test
    void parseRefCanonicaDoNome_ignoraSemPadrao() {
        assertThat(ProjudiPeticaoAssinaturaService.parseRefCanonicaDoNome("documento-assinado.p7s")).isEmpty();
    }
}
