package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiProcessoCivelRevisaoHtmlUtilTest {

    @Test
    void extrairFormulario_distribuicaoConfirmar() throws Exception {
        Path htmlPath = Path.of(
                "../e-vilareal-react-web/projudi-inicial-capture/bodies/0427_projudi_tjgo_jus_br_ProcessoCivel.html");
        String html = Files.readString(htmlPath);
        var form = ProjudiProcessoCivelRevisaoHtmlUtil.extrairFormularioDistribuicao(html);
        assertTrue(form.isPresent());
        assertEquals("ProcessoCivel", form.get().action());
        assertEquals("imgInserir", form.get().botaoNome());
        assertEquals("Confirmar", form.get().botaoValor());
        assertEquals("5", form.get().campos().get("PaginaAtual"));
        assertEquals("6", form.get().campos().get("PassoEditar"));
        assertEquals("-2147483647", form.get().campos().get("__Pedido__"));
        assertEquals("Passo 1 OK", form.get().campos().get("Passo1"));
        assertEquals("Passo 2 OK", form.get().campos().get("Passo2"));
        assertEquals("Passo 3", form.get().campos().get("Passo3"));
        assertEquals(6, form.get().campos().size());
        assertTrue(form.get().campos().keySet().stream().noneMatch(n -> n.equalsIgnoreCase("SegredoJustica")));
        assertTrue(form.get().campos().keySet().stream().noneMatch(n -> n.equalsIgnoreCase("NaoMarcarAudiencia")));
        assertTrue(form.get().campos().keySet().stream().noneMatch(n -> n.equalsIgnoreCase("digital100")));
        String corpo = form.get().montarCorpoPostIso8859();
        assertTrue(corpo.contains("PaginaAtual=5"));
        assertTrue(corpo.contains("PassoEditar=6"));
        assertTrue(corpo.contains("__Pedido__=-2147483647"));
        assertTrue(corpo.contains("Passo1=Passo+1+OK"));
        assertTrue(corpo.contains("Passo2=Passo+2+OK"));
        assertTrue(corpo.contains("Passo3=Passo+3"));
        assertTrue(corpo.contains("imgInserir=Confirmar"));
    }

    @Test
    void extrairNumero_reconheceCnjNoHtml() {
        String html =
                "<html><body>Processo distribuído: 5059346-36.2026.8.09.0007 com sucesso</body></html>";
        var ext = ProjudiProcessoCivelRevisaoHtmlUtil.extrairNumeroProcessoGerado(html, null);
        assertTrue(ext.isPresent());
        assertEquals("5059346-36.2026.8.09.0007", ext.get().numero());
        assertNotNull(ext.get().detalhe());
    }

    @Test
    void extrairNumero_reconheceCnjNoLocation() {
        var ext = ProjudiProcessoCivelRevisaoHtmlUtil.extrairNumeroProcessoGerado(
                "", "BuscaProcesso?ProcessoNumero=5059346-36.2026.8.09.0007&PassoBusca=5");
        assertTrue(ext.isPresent());
        assertEquals("5059346-36.2026.8.09.0007", ext.get().numero());
    }

    @Test
    void extrairNumero_reconheceCnjNoHtmlConfirmacaoCadastro() throws Exception {
        Path htmlPath = Path.of(
                "../e-vilareal-react-web/projudi-inicial-capture/bodies/0294_projudi_tjgo_jus_br_ProcessoCivel.html");
        String html = Files.readString(htmlPath);
        var ext = ProjudiProcessoCivelRevisaoHtmlUtil.extrairNumeroProcessoGerado(
                html, "BuscaProcesso?Id_Processo=613514431950939873912188056");
        assertTrue(ext.isPresent());
        assertEquals("0000002-00.2026.8.09.0000", ext.get().numero());
        assertTrue(ext.get().detalhe().contains("numeroProcesso"));
    }

    @Test
    void extrairNumero_idProcessoNoLocation_exigeHtmlBuscaProcesso() throws Exception {
        String location = "BuscaProcesso?Id_Processo=613083419170100873964789780&PassoBusca=5";
        assertTrue(ProjudiProcessoCivelRevisaoHtmlUtil.extrairNumeroProcessoGerado("", location).isEmpty());

        Path htmlPath = Path.of(
                "../e-vilareal-react-web/projudi-peticao-capture/bodies/"
                        + "0234_projudi_tjgo_jus_br_BuscaProcesso_Id_Processo_613083419170100873964789780_PassoB.html");
        String html = Files.readString(htmlPath);
        var ext = ProjudiProcessoCivelRevisaoHtmlUtil.extrairNumeroProcessoGerado(html, location);
        assertTrue(ext.isPresent());
        assertEquals("0000001-00.2020.8.09.0000", ext.get().numero());
    }

    @Test
    void extrairTrechoDiagnostico_reconheceMensagemErroJs() {
        String html =
                "<html><script>var mensagemErro = 'O campo Assunto Principal é obrigatório';"
                        + " var tituloErro = 'Validação';</script></html>";
        String trecho = ProjudiProcessoCivelRevisaoHtmlUtil.extrairTrechoDiagnosticoDestino302(html);
        assertTrue(trecho.contains("obrigatório") || trecho.contains("obrigatorio"));
        assertTrue(trecho.contains("mensagemErro") || trecho.contains("Assunto"));
    }

    @Test
    void classificarRedirect302_descarteUsuarioPaginaMenos10() {
        String descarte =
                "https://projudi.tjgo.jus.br/Usuario?PaginaAtual=-10&hashFluxo=abc123";
        assertTrue(ProjudiProcessoCivelRevisaoHtmlUtil.pareceRedirect302DescarteUsuario(descarte));
        assertEquals(
                "DESCARTE (Usuario PaginaAtual=-10)",
                ProjudiProcessoCivelRevisaoHtmlUtil.rotuloClassificacaoRedirect302Distribuicao(descarte));
    }

    @Test
    void classificarRedirect302_sucessoBuscaProcesso() {
        String sucesso = "BuscaProcesso?Id_Processo=613514431950939873912188056&PassoBusca=5";
        assertFalse(ProjudiProcessoCivelRevisaoHtmlUtil.pareceRedirect302DescarteUsuario(sucesso));
        assertEquals(
                "SUCESSO_PROVAVEL (destino do processo)",
                ProjudiProcessoCivelRevisaoHtmlUtil.rotuloClassificacaoRedirect302Distribuicao(sucesso));
    }

    @Test
    void extrairNumero_confirmacaoCadastroProcessoReal5589351() {
        String html =
                """
                <html><body>
                Processo cadastrado com sucesso
                <a id="numeroProcesso">5589351-81.2026.8.09.0007</a>
                </body></html>
                """;
        var ext = ProjudiProcessoCivelRevisaoHtmlUtil.extrairNumeroProcessoGerado(
                html, "BuscaProcesso?Id_Processo=613999999999999999999999999");
        assertTrue(ext.isPresent());
        assertEquals("5589351-81.2026.8.09.0007", ext.get().numero());
    }

    @Test
    void caminhoGetPosRedirect_normalizaUrlAbsoluta() {
        assertEquals(
                "BuscaProcesso?Id_Processo=123",
                ProjudiProcessoCivelRevisaoHtmlUtil.caminhoGetPosRedirect(
                        "https://projudi.tjgo.jus.br/BuscaProcesso?Id_Processo=123"));
    }

    @Test
    void formatarCorpoPasso3_listaCamposDoFormRevisao() throws Exception {
        Path htmlPath = Path.of(
                "../e-vilareal-react-web/projudi-inicial-capture/bodies/0427_projudi_tjgo_jus_br_ProcessoCivel.html");
        String html = Files.readString(htmlPath);
        var form = ProjudiProcessoCivelRevisaoHtmlUtil.extrairFormularioDistribuicao(html);
        assertTrue(form.isPresent());
        String corpo = ProjudiProcessoCivelRevisaoHtmlUtil.formatarCorpoPasso3(form.get());
        assertTrue(corpo.startsWith("action=ProcessoCivel | "));
        assertTrue(corpo.contains("PaginaAtual=5"));
        assertTrue(corpo.contains("__Pedido__=-2147483647"));
        assertTrue(corpo.contains("imgInserir=Confirmar"));
        assertEquals("-2147483647", ProjudiProcessoCivelRevisaoHtmlUtil.pedidoValorNoFormulario(form.get()));
    }

    @Test
    void extrairFormulario_digital100MarcadoNoHtml_entraNoCorpoQuandoOpcaoAtiva() {
        String html =
                """
                <form id="Formulario" action="ProcessoCivel">
                  <input type="hidden" name="PaginaAtual" value="5"/>
                  <input type="hidden" name="PassoEditar" value="6"/>
                  <input type="hidden" name="__Pedido__" value="-1"/>
                  <input type="hidden" name="Passo1" value="Passo 1 OK"/>
                  <input type="hidden" name="Passo2" value="Passo 2 OK"/>
                  <input type="hidden" name="Passo3" value="Passo 3"/>
                  <input type="checkbox" name="digital100" value="true" checked="checked"/>
                  <input type="submit" name="imgInserir" value="Confirmar"/>
                </form>
                """;
        var form = ProjudiProcessoCivelRevisaoHtmlUtil.extrairFormularioDistribuicao(html);
        assertTrue(form.isPresent());
        assertEquals("true", form.get().campos().get("digital100"));
        var formFinal = form.get().comOpcoesPasso3(new ProjudiInicialOpcoesPasso3(false, false, false));
        String corpo = formFinal.montarCorpoPostIso8859();
        assertFalse(corpo.toLowerCase(Locale.ROOT).contains("digital100"));
        var formComDigital = form.get().comOpcoesPasso3(new ProjudiInicialOpcoesPasso3(false, false, true));
        corpo = formComDigital.montarCorpoPostIso8859();
        assertTrue(corpo.contains("digital100=true"));
        assertTrue(corpo.contains("imgInserir=Confirmar"));
    }

    @Test
    void comOpcoesPasso3_aplicaTresCheckboxes() {
        String html =
                """
                <form id="Formulario" action="ProcessoCivel">
                  <input type="hidden" name="PaginaAtual" value="5"/>
                  <input type="hidden" name="PassoEditar" value="6"/>
                  <input type="hidden" name="__Pedido__" value="-1"/>
                  <input type="submit" name="imgInserir" value="Confirmar"/>
                </form>
                """;
        var form = ProjudiProcessoCivelRevisaoHtmlUtil.extrairFormularioDistribuicao(html);
        assertTrue(form.isPresent());
        var formFinal = form.get().comOpcoesPasso3(new ProjudiInicialOpcoesPasso3(true, true, false));
        assertEquals("true", formFinal.campos().get("SegredoJustica"));
        assertEquals("false", formFinal.campos().get("NaoMarcarAudiencia"));
        assertTrue(formFinal.campos().keySet().stream().noneMatch(n -> n.equalsIgnoreCase("digital100")));
    }

    @Test
    void extrairFormulario_incluiCheckboxMarcado() {
        String html =
                """
                <form id="Formulario" action="ProcessoCivel">
                  <input type="hidden" name="PaginaAtual" value="-1"/>
                  <input type="hidden" name="PassoEditar" value="6"/>
                  <input type="checkbox" name="SegredoJustica" value="true" checked="checked"/>
                  <input type="checkbox" name="NaoMarcarAudiencia" value="false"/>
                  <input type="submit" name="imgInserir" value="Confirmar" onclick="AlterarValue('PaginaAtual',5);"/>
                </form>
                """;
        var form = ProjudiProcessoCivelRevisaoHtmlUtil.extrairFormularioDistribuicao(html);
        assertTrue(form.isPresent());
        assertEquals("true", form.get().campos().get("SegredoJustica"));
        assertTrue(form.get().campos().keySet().stream().noneMatch(n -> n.equalsIgnoreCase("NaoMarcarAudiencia")));
    }
}
