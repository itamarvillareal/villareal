package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProjudiArquivoAssinavelUtilTest {

    @Test
    void isNomeAssinavel_aceitaPdfJpegJpgEMp4() {
        assertThat(ProjudiArquivoAssinavelUtil.isNomeAssinavel("peticao.pdf")).isTrue();
        assertThat(ProjudiArquivoAssinavelUtil.isNomeAssinavel("FOTO.JPG")).isTrue();
        assertThat(ProjudiArquivoAssinavelUtil.isNomeAssinavel("foto.jpeg")).isTrue();
        assertThat(ProjudiArquivoAssinavelUtil.isNomeAssinavel("video.mp4")).isTrue();
        assertThat(ProjudiArquivoAssinavelUtil.isNomeAssinavel(" video.MP4 ")).isTrue();
    }

    @Test
    void isNomeAssinavel_rejeitaOutrosTipos() {
        assertThat(ProjudiArquivoAssinavelUtil.isNomeAssinavel("assinado.p7s")).isFalse();
        assertThat(ProjudiArquivoAssinavelUtil.isNomeAssinavel("documento.docx")).isFalse();
        assertThat(ProjudiArquivoAssinavelUtil.isNomeAssinavel("imagem.png")).isFalse();
        assertThat(ProjudiArquivoAssinavelUtil.isNomeAssinavel(null)).isFalse();
        assertThat(ProjudiArquivoAssinavelUtil.isNomeAssinavel("")).isFalse();
    }

    @Test
    void extensaoStore_preservaExtensaoOriginal() {
        assertThat(ProjudiArquivoAssinavelUtil.extensaoStore("peticao.pdf")).isEqualTo(".pdf");
        assertThat(ProjudiArquivoAssinavelUtil.extensaoStore("Foto.JPG")).isEqualTo(".jpg");
        assertThat(ProjudiArquivoAssinavelUtil.extensaoStore("foto.jpeg")).isEqualTo(".jpeg");
        assertThat(ProjudiArquivoAssinavelUtil.extensaoStore("video.mp4")).isEqualTo(".mp4");
    }

    @Test
    void extensaoStore_padraoPdfQuandoDesconhecida() {
        assertThat(ProjudiArquivoAssinavelUtil.extensaoStore("sem-extensao")).isEqualTo(".pdf");
        assertThat(ProjudiArquivoAssinavelUtil.extensaoStore(null)).isEqualTo(".pdf");
    }

    @Test
    void mimeTypePorNome_resolveTipos() {
        assertThat(ProjudiArquivoAssinavelUtil.mimeTypePorNome("peticao.pdf")).isEqualTo("application/pdf");
        assertThat(ProjudiArquivoAssinavelUtil.mimeTypePorNome("foto.jpg")).isEqualTo("image/jpeg");
        assertThat(ProjudiArquivoAssinavelUtil.mimeTypePorNome("foto.jpeg")).isEqualTo("image/jpeg");
        assertThat(ProjudiArquivoAssinavelUtil.mimeTypePorNome("video.mp4")).isEqualTo("video/mp4");
        assertThat(ProjudiArquivoAssinavelUtil.mimeTypePorNome("desconhecido")).isEqualTo("application/pdf");
    }
}
