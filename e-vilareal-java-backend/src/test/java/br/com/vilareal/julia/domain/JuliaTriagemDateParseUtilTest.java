package br.com.vilareal.julia.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class JuliaTriagemDateParseUtilTest {

    @Test
    void parseDataResposta_iso() {
        assertThat(JuliaTriagemDateParseUtil.parseDataResposta("2026-06-01"))
                .isEqualTo(LocalDate.of(2026, 6, 1));
    }

    @Test
    void parseDataResposta_br() {
        assertThat(JuliaTriagemDateParseUtil.parseDataResposta("01/06/2026"))
                .isEqualTo(LocalDate.of(2026, 6, 1));
    }

    @Test
    void parseDataResposta_trim() {
        assertThat(JuliaTriagemDateParseUtil.parseDataResposta("  01/06/2026  "))
                .isEqualTo(LocalDate.of(2026, 6, 1));
    }

    @Test
    void parseDataResposta_invalidoRetornaNull() {
        assertThat(JuliaTriagemDateParseUtil.parseDataResposta("não-é-data")).isNull();
        assertThat(JuliaTriagemDateParseUtil.parseDataResposta(null)).isNull();
        assertThat(JuliaTriagemDateParseUtil.parseDataResposta("")).isNull();
    }
}
