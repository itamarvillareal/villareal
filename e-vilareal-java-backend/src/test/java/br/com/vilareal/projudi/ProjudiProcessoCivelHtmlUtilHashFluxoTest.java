package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiProcessoCivelHtmlUtilHashFluxoTest {

    @Test
    void extrairDiagnostico_revisaoTemPedidoMinInt() throws Exception {
        Path htmlPath = Path.of(
                "../e-vilareal-react-web/projudi-inicial-capture/bodies/0427_projudi_tjgo_jus_br_ProcessoCivel.html");
        String html = Files.readString(htmlPath);
        var d = ProjudiProcessoCivelHtmlUtil.extrairDiagnosticoHashFluxo(html);
        assertEquals("-2147483647", d.pedidoInput());
        assertTrue(ProjudiProcessoCivelHtmlUtil.formatarLinhaHashFluxoHtml(html).contains("__Pedido__=-2147483647"));
    }

    @Test
    void extrairDiagnostico_passoPartesTemHashLongo() throws Exception {
        Path htmlPath = Path.of(
                "../e-vilareal-react-web/projudi-inicial-capture/bodies/0269_projudi_tjgo_jus_br_ProcessoCivel.html");
        String html = Files.readString(htmlPath);
        var d = ProjudiProcessoCivelHtmlUtil.extrairDiagnosticoHashFluxo(html);
        assertNotNull(d.hashInput());
        assertTrue(d.hashInput().length() > 10);
    }
}
