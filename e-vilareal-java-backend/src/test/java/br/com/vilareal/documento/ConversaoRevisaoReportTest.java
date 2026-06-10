package br.com.vilareal.documento;

import br.com.vilareal.documento.TopicoLegadoConversor.TopicoConvertido;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

/**
 * Artefato de REVISÃO (não é teste de produção): relê os blocos legados reais da execução de taxa
 * condominial ({@code /tmp/topico_exec_cond_raw.txt}), roda {@link TopicoLegadoConversor#converter}
 * e imprime um relatório em texto puro (stdout + {@code /tmp/conversao_revisao.txt}).
 * Não altera banco, produção nem o conversor. Pulado se o arquivo de entrada não existir.
 */
class ConversaoRevisaoReportTest {

    private static final String MARK_OPEN = "+++";
    private static final String MARK_CLOSE = "/\\";

    private static final String[] NOME_FORMATO = {
        "", "itálico", "negrito", "sublinhado", "vermelho",
        "fundo amarelo", "fundo azul-claro", "fundo azul-escuro", "fundo laranja",
    };

    @Test
    void gerarRelatorio() throws IOException {
        Path raw = Path.of("/tmp/topico_exec_cond_raw.txt");
        Assumptions.assumeTrue(Files.exists(raw), "arquivo de blocos reais ausente; relatório pulado");

        // captura de avisos do conversor (System.Logger -> java.util.logging)
        Logger jul = Logger.getLogger(TopicoLegadoConversor.class.getName());
        jul.setUseParentHandlers(false);
        List<String> capturados = new ArrayList<>();
        Handler handler = new Handler() {
            @Override
            public void publish(LogRecord r) {
                String m = r.getMessage();
                Object[] p = r.getParameters();
                capturados.add(p != null && p.length > 0 ? MessageFormat.format(m, p) : m);
            }

            @Override
            public void flush() {}

            @Override
            public void close() {}
        };
        jul.addHandler(handler);
        jul.setLevel(Level.ALL);

        List<String> linhas = Files.readAllLines(raw, StandardCharsets.UTF_8);
        StringBuilder out = new StringBuilder();
        List<String> blocosComAvisos = new ArrayList<>();
        int total = 0;

        for (String linha : linhas) {
            if (!linha.startsWith("@@@REC@@@|")) {
                continue;
            }
            String[] parts = linha.split("\\|", 4);
            if (parts.length < 4) {
                continue;
            }
            String chaveCurta = abreviarChave(parts[1]);
            String bloco = parts[2];
            String conteudo = parts[3];

            int antes = capturados.size();
            TopicoConvertido r = TopicoLegadoConversor.converter(conteudo);
            List<String> avisosDoBloco = new ArrayList<>(capturados.subList(antes, capturados.size()));

            out.append("=== ").append(chaveCurta)
                    .append(" | bloco ").append(bloco)
                    .append(" | classe=").append(r.classe()).append(" ===\n");

            out.append("PARES PREENCHIDOS:\n");
            List<String> pares = paresPreenchidos(conteudo);
            if (pares.isEmpty()) {
                out.append("  nenhum\n");
            } else {
                for (String p : pares) {
                    out.append("  ").append(p).append('\n');
                }
            }

            out.append("HTML: ").append(r.html()).append('\n');
            out.append("AVISOS: ").append(avisosDoBloco.isEmpty() ? "—" : String.join(" | ", avisosDoBloco))
                    .append("\n\n");

            if (!avisosDoBloco.isEmpty()) {
                blocosComAvisos.add(chaveCurta + " | bloco " + bloco + " :: " + String.join(" | ", avisosDoBloco));
            }
            total++;
        }

        out.append("================================================================\n");
        out.append("BLOCOS COM AVISOS\n");
        out.append("================================================================\n");
        if (blocosComAvisos.isEmpty()) {
            out.append("Nenhum bloco com aviso — todos os pares preenchidos foram localizados.\n");
        } else {
            for (String b : blocosComAvisos) {
                out.append("- ").append(b).append('\n');
            }
        }
        out.append("\nTotal de blocos: ").append(total).append('\n');

        jul.removeHandler(handler);

        String relatorio = out.toString();
        Path destino = Path.of("/tmp/conversao_revisao.txt");
        Files.writeString(destino, relatorio, StandardCharsets.UTF_8);

        System.out.println(relatorio);
        System.out.println("[gerarRelatorio] relatório salvo em: " + destino.toAbsolutePath());
    }

    /** Abrevia "INICIAL=...=003. DOS FATOS" → "003 DOS FATOS". */
    private static String abreviarChave(String chave) {
        String[] seg = chave.split("=");
        String ultimo = seg.length > 0 ? seg[seg.length - 1] : chave;
        return ultimo.replace(".", "").replaceAll("\\s+", " ").trim();
    }

    /**
     * Replica (apenas para o relatório) a leitura dos pares 1..8 do bloco legado, listando os
     * preenchidos com a posição/formatação e o alvo (trecho entre +++ e /\).
     */
    private static List<String> paresPreenchidos(String bloco) {
        List<String> res = new ArrayList<>();
        List<String> campos = lerCampos(bloco);
        for (int idx = 0; idx < campos.size() && idx < 8; idx++) {
            String campo = stripQuotes(campos.get(idx));
            int o = campo.indexOf(MARK_OPEN);
            if (o < 0) {
                continue;
            }
            int c = campo.indexOf(MARK_CLOSE, o + MARK_OPEN.length());
            String alvo = c >= 0 ? campo.substring(o + MARK_OPEN.length(), c) : "(sem fechamento /\\)";
            int pos = idx + 1;
            res.add("[" + pos + " " + NOME_FORMATO[pos] + "]    alvo=\"" + alvo + "\"");
        }
        return res;
    }

    private static List<String> lerCampos(String bloco) {
        List<String> campos = new ArrayList<>();
        String s = bloco != null ? bloco : "";
        int n = s.length();
        int i = 0;
        while (i < n && Character.isWhitespace(s.charAt(i))) {
            i++;
        }
        if (i < n && s.charAt(i) == '(') {
            int end = matchGroup(s, i);
            if (end >= 0) {
                i = end + 1;
            }
        }
        int j = i;
        while (j < n && Character.isWhitespace(s.charAt(j))) {
            j++;
        }
        if (j < n && s.charAt(j) == '(') {
            i = j;
        }
        while (i < n && s.charAt(i) == '(') {
            int end = matchGroup(s, i);
            if (end < 0) {
                break;
            }
            String conteudo = stripParens(s.substring(i, end + 1));
            String t = conteudo.trim();
            if (t.equals("...") || t.equals("\u2026")) {
                break;
            }
            campos.add(conteudo);
            i = end + 1;
        }
        return campos;
    }

    private static int matchGroup(String s, int open) {
        int depth = 0;
        for (int k = open; k < s.length(); k++) {
            char ch = s.charAt(k);
            if (ch == '(') {
                depth++;
            } else if (ch == ')') {
                depth--;
                if (depth == 0) {
                    return k;
                }
            }
        }
        return -1;
    }

    private static String stripParens(String g) {
        if (g.length() >= 2 && g.charAt(0) == '(' && g.charAt(g.length() - 1) == ')') {
            return g.substring(1, g.length() - 1);
        }
        return g;
    }

    private static String stripQuotes(String s) {
        String t = s;
        while (t.length() >= 2 && t.charAt(0) == '"' && t.charAt(t.length() - 1) == '"') {
            t = t.substring(1, t.length() - 1);
        }
        return t;
    }
}
