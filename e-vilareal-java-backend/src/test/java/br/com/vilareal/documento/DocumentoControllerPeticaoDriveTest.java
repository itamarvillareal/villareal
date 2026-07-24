package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoControllerPeticaoDriveTest {

    @Test
    void temContextoProcessoComProcessoId() {
        assertThat(DocumentoController.temContextoProcesso(42L, null, null)).isTrue();
    }

    @Test
    void temContextoProcessoComChaveNatural() {
        assertThat(DocumentoController.temContextoProcesso(null, "00000752", 264)).isTrue();
    }

    @Test
    void semContextoProcessoSemVinculo() {
        assertThat(DocumentoController.temContextoProcesso(null, null, null)).isFalse();
        assertThat(DocumentoController.temContextoProcesso(0L, " ", null)).isFalse();
    }

    @Test
    void nomeArquivoPeticaoReformatada_usaPrefixo01() {
        assertThat(DocumentoController.nomeArquivoPeticaoReformatada(java.time.LocalDate.of(2026, 7, 24)))
                .isEqualTo("01.PeticaoFormatada.pdf");
    }
}
