package br.com.vilareal.documento;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

import br.com.vilareal.documento.TopicoLegadoConversor.TopicoConvertido;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

class TopicoLegadoConversorTest {

    @Test
    void titulo() {
        TopicoConvertido r = TopicoLegadoConversor.converter("(\"TÍTULO\")()()()()()()()()DOS FATOS:");
        assertEquals("titulo", r.classe());
        assertEquals("DOS FATOS:", r.html());
    }

    @Test
    void italico() {
        TopicoConvertido r = TopicoLegadoConversor.converter(
                "(\"N SEQUENCIAL\")(\"Da obrigação +++propter rem/\\ ao pagamento:\")()()()()()()()"
                        + "Da obrigação propter rem ao pagamento:");
        assertEquals("subtitulo", r.classe());
        assertEquals("Da obrigação <em>propter rem</em> ao pagamento:", r.html());
    }

    @Test
    void negritoComToken() {
        TopicoConvertido r = TopicoLegadoConversor.converter(
                "(\"PARÁGRAFO\")()(\"quantia de +++RetornaValorTotalDoDebito(\"@\",\"@\")/\\, porém\")()()()()()()"
                        + "quantia de RetornaValorTotalDoDebito(\"@\",\"@\"), porém");
        assertEquals("paragrafo", r.classe());
        assertEquals("quantia de <strong>{{totalDebito}}</strong>, porém", r.html());
    }

    @Test
    void flexaoComCaixa() {
        TopicoConvertido r = TopicoLegadoConversor.converter(
                "(\"PARÁGRAFO\")()()()()()()()()"
                        + "Propercase(Adequa(\"@\",\"reu\",\"o\")) Propercase(Adequa(\"@\",\"reu\",\"executado\")) "
                        + "está inadimplente");
        assertEquals("paragrafo", r.classe());
        assertEquals("{{flex:reu:o|proper}} {{flex:reu:executado|proper}} está inadimplente", r.html());
    }

    @Test
    void fundoAmarelo() {
        TopicoConvertido r = TopicoLegadoConversor.converter(
                "(\"PEDIDO\")()()()()(\"destaque +++importante/\\ aqui\")()()()destaque importante aqui");
        assertEquals("pedido", r.classe());
        assertEquals("destaque <span class=\"fundo-amarelo\">importante</span> aqui", r.html());
    }

    @Test
    void macroDeDebitos() {
        TopicoConvertido r = TopicoLegadoConversor.converter(
                "(\"MACRO\")()()()()()()()()CallMacro([Módulo9].Calculos_da_Planilha_de_Calculos"
                        + "(\"Taxa condominial vencida em \",\"Completo\",\"Todos\"))");
        assertEquals("macro", r.classe());
        assertEquals("{{debitos:Completo|Taxa condominial vencida em |Todos}}", r.html());
    }

    @Test
    void escapeDeHtml() {
        TopicoConvertido r = TopicoLegadoConversor.converter("(\"PARÁGRAFO\")()()()()()()()()A & B");
        assertEquals("paragrafo", r.classe());
        assertEquals("A &amp; B", r.html());
    }

    @Test
    void alvoComEspacosDeBordaFicamForaDaTag() {
        // alvo entre +++ e /\ tem espaço nas bordas: "+++ RetornaValorTotalDoDebito(...)/\"
        TopicoConvertido r = TopicoLegadoConversor.converter(
                "(\"PARÁGRAFO\")()(\"de+++ RetornaValorTotalDoDebito(\"@\",\"@\")/\\, porém\")"
                        + "(\"de+++ RetornaValorTotalDoDebito(\"@\",\"@\")/\\, porém\")()()()()()"
                        + "de RetornaValorTotalDoDebito(\"@\",\"@\"), porém");
        // espaço de borda preservado FORA do <strong><u>...
        assertEquals("de <strong><u>{{totalDebito}}</u></strong>, porém", r.html());
    }

    @Test
    void aninhamentoNegritoSublinhado() {
        // pares 2 (negrito) e 3 (sublinhado) sobre o mesmo alvo → aninhar
        TopicoConvertido r = TopicoLegadoConversor.converter(
                "(\"PARÁGRAFO\")()(\"de +++importante/\\ porém\")(\"de +++importante/\\ porém\")()()()()()"
                        + "de importante porém");
        assertEquals("de <strong><u>importante</u></strong> porém", r.html());
    }

    /**
     * Validação com dados reais (não-assert): lê os blocos exportados de
     * {@code /tmp/topico_exec_cond_raw.txt} (003. DOS FATOS, 004. DOS TÍTULOS (Completo), 005. DO DIREITO),
     * converte cada um e grava o resultado em {@code /tmp/conversao_execucao_condominial.html} para revisão.
     * Pulado se o arquivo de entrada não existir.
     */
    @Test
    void dumpConversaoReal() throws IOException {
        Path raw = Path.of("/tmp/topico_exec_cond_raw.txt");
        Assumptions.assumeTrue(Files.exists(raw), "arquivo de blocos reais ausente; dump pulado");

        List<String> linhas = Files.readAllLines(raw, StandardCharsets.UTF_8);
        StringBuilder sb = new StringBuilder();
        sb.append("<!doctype html>\n<meta charset=\"utf-8\">\n<style>")
                .append("body{font-family:serif;max-width:820px;margin:24px auto;line-height:1.5}")
                .append(".titulo{font-weight:700;text-transform:uppercase;margin-top:18px}")
                .append(".subtitulo{font-weight:700;margin-top:12px}")
                .append(".recuado{margin-left:40px;font-size:.95em}")
                .append(".pedido{margin-left:20px}")
                .append(".macro{background:#eef;padding:4px;font-family:monospace}")
                .append("small{color:#999;font-weight:400}")
                .append(".txt-vermelho{color:#c00}.fundo-amarelo{background:#ff6}.fundo-azul-claro{background:#cdf}")
                .append(".fundo-azul-escuro{background:#9ac}.fundo-laranja{background:#fc9}")
                .append("</style>\n");

        String chaveAtual = "";
        int total = 0;
        for (String linha : linhas) {
            if (!linha.startsWith("@@@REC@@@|")) {
                continue;
            }
            String[] parts = linha.split("\\|", 4);
            if (parts.length < 4) {
                continue;
            }
            String chave = parts[1];
            String bloco = parts[2];
            String conteudo = parts[3];
            if (!chave.equals(chaveAtual)) {
                sb.append("<h2>").append(chave).append("</h2>\n");
                chaveAtual = chave;
            }
            TopicoConvertido r = TopicoLegadoConversor.converter(conteudo);
            sb.append("<div class=\"").append(r.classe()).append("\">")
                    .append("<small>b").append(bloco).append(" [").append(r.classe()).append("]</small> ")
                    .append(r.html())
                    .append("</div>\n");
            total++;
        }

        Path out = Path.of("/tmp/conversao_execucao_condominial.html");
        Files.writeString(out, sb.toString(), StandardCharsets.UTF_8);
        System.out.println("[dumpConversaoReal] " + total + " blocos convertidos → " + out.toAbsolutePath());
        assertThat(total).isGreaterThan(0);
    }
}
