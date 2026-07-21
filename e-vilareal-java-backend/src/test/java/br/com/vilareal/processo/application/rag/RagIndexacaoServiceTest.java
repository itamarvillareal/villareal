package br.com.vilareal.processo.application.rag;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RagIndexacaoServiceTest {

    @Test
    void extrairDataMovIso_converteDataBr() {
        assertThat(RagIndexacaoService.extrairDataMovIso("05/03/2026 20:00:00")).isEqualTo("2026-03-05");
        assertThat(RagIndexacaoService.extrairDataMovIso("05/03/2026")).isEqualTo("2026-03-05");
        assertThat(RagIndexacaoService.extrairDataMovIso(null)).isNull();
        assertThat(RagIndexacaoService.extrairDataMovIso("invalido")).isNull();
    }

    @Test
    void normalizarTipoPeca_minuscultasOuOutros() {
        assertThat(RagIndexacaoService.normalizarTipoPeca("Despacho")).isEqualTo("despacho");
        assertThat(RagIndexacaoService.normalizarTipoPeca("  ")).isEqualTo("outros");
    }

    @Test
    void fonteId_prefixoDrive() {
        var arq = new RagArquivoDriveEnviado("abc123", "0026.pdf", "despacho", "2026-03-05", "tok");
        assertThat(arq.fonteId()).isEqualTo("drive:abc123");
    }

    @Test
    void montarComando_incluiArgumentosEssenciais() {
        RagIndexacaoProperties props = new RagIndexacaoProperties();
        props.setPython("python3");
        RagIndexacaoService svc = new RagIndexacaoService(props, null);
        var cmd = svc.montarComando(
                "5009686-73.2026.8.09.0007",
                java.nio.file.Path.of("/tmp/x.pdf"),
                "contestação",
                "fileId99",
                "2026-03-05");
        assertThat(cmd).containsExactly(
                "python3",
                "-m",
                "processo_rag",
                "indexar-arquivo",
                "5009686-73.2026.8.09.0007",
                "/tmp/x.pdf",
                "--tipo",
                "contestação",
                "--drive-file-id",
                "fileId99",
                "--data-mov",
                "2026-03-05");
    }
}
