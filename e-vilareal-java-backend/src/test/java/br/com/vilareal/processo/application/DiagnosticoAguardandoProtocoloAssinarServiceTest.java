package br.com.vilareal.processo.application;

import br.com.vilareal.processo.api.dto.PrepararAssinarResultado;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DiagnosticoAguardandoProtocoloAssinarServiceTest {

    @Test
    void isNomeCanonicoStorePdf_reconheceCopiasDoBackend() {
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf("119_1_14f46e51.pdf"))
                .isTrue();
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf(" 119_12_14F46E51.pdf "))
                .isTrue();
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf("119_1_14f46e51.jpg"))
                .isTrue();
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf("119_1_14f46e51.jpeg"))
                .isTrue();
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf("119_1_14f46e51.mp4"))
                .isTrue();
    }

    @Test
    void isNomeCanonicoStorePdf_preservaNomesOriginaisDoUsuario() {
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf("Petição.pdf"))
                .isFalse();
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf("Cálculo.pdf"))
                .isFalse();
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf("119_peticao.pdf"))
                .isFalse();
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf("119_1_sha8.pdf"))
                .isFalse();
    }

    @Test
    void montarMensagemNenhumPdfPreparado_listaProcessosComErro() {
        List<PrepararAssinarResultado.ResumoProcessoPrepararAssinar> resumos = List.of(
                new PrepararAssinarResultado.ResumoProcessoPrepararAssinar(
                        "123", "00000183", 0, 0, 0, false, true, "data inválida no cadastro"),
                new PrepararAssinarResultado.ResumoProcessoPrepararAssinar(
                        "456", "00000001", 0, 0, 0, true, false, null));

        String msg = DiagnosticoAguardandoProtocoloAssinarService.montarMensagemNenhumPdfPreparado(resumos);

        assertThat(msg).contains("1 processo(s) ignorado(s) por erro");
        assertThat(msg).contains("00000183");
        assertThat(msg).contains("data inválida no cadastro");
    }
}
