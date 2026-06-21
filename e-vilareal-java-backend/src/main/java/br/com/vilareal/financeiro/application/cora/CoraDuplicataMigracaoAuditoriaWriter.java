package br.com.vilareal.financeiro.application.cora;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** Persiste o log de auditoria da migração Lote A em TSV (reversão manual/automática). */
@Component
public class CoraDuplicataMigracaoAuditoriaWriter {

    private static final Logger log = LoggerFactory.getLogger(CoraDuplicataMigracaoAuditoriaWriter.class);
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HHmmss");

    public Path persistir(CoraDuplicataLoteARelatorio rel) throws IOException {
        Path dir = Paths.get("data", "backups");
        Files.createDirectories(dir);
        String nome = "lote-a-migracao-audit-" + LocalDateTime.now().format(TS) + ".tsv";
        Path arquivo = dir.resolve(nome).toAbsolutePath();
        StringBuilder sb = new StringBuilder();
        sb.append("planilha_id\tofx_id\ttabela\tcampo\tvalor_antes\tvalor_depois\n");
        for (CoraDuplicataMigracaoAuditoriaLinha linha : rel.getAuditoria()) {
            sb.append(csv(linha.planilhaId()))
                    .append('\t')
                    .append(csv(linha.ofxId()))
                    .append('\t')
                    .append(csv(linha.tabela()))
                    .append('\t')
                    .append(csv(linha.campo()))
                    .append('\t')
                    .append(csv(linha.valorAntes()))
                    .append('\t')
                    .append(csv(linha.valorDepois()))
                    .append('\n');
        }
        Files.writeString(arquivo, sb.toString(), StandardCharsets.UTF_8);
        log.info("Auditoria migração Lote A persistida: {} ({} linhas)", arquivo, rel.getAuditoria().size());
        return arquivo;
    }

    public List<CoraDuplicataMigracaoAuditoriaLinha> ler(Path arquivo) throws IOException {
        List<String> linhas = Files.readAllLines(arquivo, StandardCharsets.UTF_8);
        if (linhas.size() <= 1) {
            return List.of();
        }
        return linhas.stream().skip(1).map(this::parseLinha).toList();
    }

    private CoraDuplicataMigracaoAuditoriaLinha parseLinha(String linha) {
        String[] p = linha.split("\t", -1);
        return new CoraDuplicataMigracaoAuditoriaLinha(
                parseLong(p[0]),
                parseLong(p[1]),
                uncsv(p[2]),
                uncsv(p[3]),
                uncsv(p[4]),
                uncsv(p[5]));
    }

    private static Long parseLong(String s) {
        if (s == null || s.isBlank() || "null".equals(s)) {
            return null;
        }
        return Long.parseLong(s.trim());
    }

    private static String csv(Object v) {
        if (v == null) {
            return "";
        }
        String s = String.valueOf(v);
        if (s.contains("\t") || s.contains("\n") || s.contains("\r")) {
            return '"' + s.replace("\"", "\"\"") + '"';
        }
        return s;
    }

    private static String uncsv(String s) {
        if (s == null || s.isEmpty()) {
            return null;
        }
        if (s.startsWith("\"") && s.endsWith("\"")) {
            return s.substring(1, s.length() - 1).replace("\"\"", "\"");
        }
        return s;
    }
}
