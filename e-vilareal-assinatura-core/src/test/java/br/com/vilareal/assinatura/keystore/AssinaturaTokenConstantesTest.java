package br.com.vilareal.assinatura.keystore;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AssinaturaTokenConstantesTest {

    @Test
    void normalizarThumbprintSha1_removeEspacosEUppercase() {
        assertThat(AssinaturaTokenConstantes.normalizarThumbprintSha1("012d d874 d9f1 5473"))
                .isEqualTo("012DD874D9F15473");
        assertThat(AssinaturaTokenConstantes.normalizarThumbprintSha1(" c695ba1e... "))
                .isEqualTo("C695BA1E...");
    }

    @Test
    void defaultThumbprintPermaneceTokenAntigo() {
        assertThat(AssinaturaTokenConstantes.SIGNER_THUMBPRINT_SHA1)
                .isEqualTo("C695BA1EC72328487E8FCDC4C34357FEFDD3D100");
    }
}
