package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProcuracaoServiceTest {

    @Test
    void formatarCpf_delegaParaUtil() {
        assertThat(QualificacaoPessoaUtil.formatarCpf("12345678901")).isEqualTo("123.456.789-01");
    }
}
