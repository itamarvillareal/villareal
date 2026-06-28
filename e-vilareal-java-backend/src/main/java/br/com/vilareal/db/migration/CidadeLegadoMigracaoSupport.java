package br.com.vilareal.db.migration;

import br.com.vilareal.localidade.domain.MunicipioTextoUtil;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Migra cidade/UF legado para municipio_id quando o match for seguro; demais vão para cidade_legado + CSV.
 */
public final class CidadeLegadoMigracaoSupport {

    private CidadeLegadoMigracaoSupport() {}

    public static void executar(Connection conn) throws Exception {
        IndiceMigracao indice = carregarIndiceMunicipios(conn);
        Resumo resumo = new Resumo();
        List<String[]> pendentes = new ArrayList<>();

        migrarPessoaEndereco(conn, indice, resumo, pendentes);
        migrarProcesso(conn, indice, resumo, pendentes);

        gravarRelatorio(pendentes, resumo);
    }

    private static IndiceMigracao carregarIndiceMunicipios(Connection conn) throws Exception {
        Map<String, List<Integer>> porNomeUf = new HashMap<>();
        Map<String, List<Integer>> porNome = new HashMap<>();
        try (PreparedStatement ps =
                        conn.prepareStatement(
                                "SELECT m.id, m.nome_normalizado, e.sigla FROM municipio m JOIN estado e ON e.id = m.uf_id");
                ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                int id = rs.getInt(1);
                String nomeNorm = rs.getString(2);
                String uf = rs.getString(3);
                porNomeUf.computeIfAbsent(chave(nomeNorm, uf), k -> new ArrayList<>()).add(id);
                porNome.computeIfAbsent(nomeNorm, k -> new ArrayList<>()).add(id);
            }
        }
        return new IndiceMigracao(porNomeUf, porNome);
    }

    private record IndiceMigracao(Map<String, List<Integer>> porNomeUf, Map<String, List<Integer>> porNome) {}

    private static void migrarPessoaEndereco(
            Connection conn, IndiceMigracao indice, Resumo resumo, List<String[]> pendentes)
            throws Exception {
        String sel =
                """
                SELECT id, cidade, estado FROM pessoa_endereco
                WHERE municipio_id IS NULL AND cidade IS NOT NULL AND TRIM(cidade) <> ''
                """;
        try (PreparedStatement ps = conn.prepareStatement(sel);
                ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                long id = rs.getLong(1);
                String cidade = rs.getString(2);
                String uf = MunicipioTextoUtil.normalizarUf(rs.getString(3));
                aplicarMatch(conn, "pessoa_endereco", id, cidade, uf, indice, resumo, pendentes);
            }
        }
    }

    private static void migrarProcesso(
            Connection conn, IndiceMigracao indice, Resumo resumo, List<String[]> pendentes)
            throws Exception {
        String sel =
                """
                SELECT id, cidade, uf FROM processo
                WHERE municipio_id IS NULL AND cidade IS NOT NULL AND TRIM(cidade) <> ''
                """;
        try (PreparedStatement ps = conn.prepareStatement(sel);
                ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                long id = rs.getLong(1);
                String cidade = rs.getString(2);
                String uf = MunicipioTextoUtil.normalizarUf(rs.getString(3));
                aplicarMatch(conn, "processo", id, cidade, uf, indice, resumo, pendentes);
            }
        }
    }

    private static void aplicarMatch(
            Connection conn,
            String tabela,
            long id,
            String cidade,
            String uf,
            IndiceMigracao indice,
            Resumo resumo,
            List<String[]> pendentes)
            throws Exception {
        String nomeNorm = MunicipioTextoUtil.normalizarNome(cidade);
        List<Integer> candidatos =
                uf != null ? indice.porNomeUf().getOrDefault(chave(nomeNorm, uf), List.of()) : List.of();
        if (candidatos.isEmpty()) {
            candidatos = indice.porNome().getOrDefault(nomeNorm, List.of());
        }
        if (candidatos.size() == 1) {
            int municipioId = candidatos.get(0);
            try (PreparedStatement upd = conn.prepareStatement(
                    "UPDATE " + tabela + " SET municipio_id = ?, cidade_legado = NULL WHERE id = ?")) {
                upd.setInt(1, municipioId);
                upd.setLong(2, id);
                upd.executeUpdate();
            }
            sincronizarDerivados(conn, tabela, id, municipioId);
            resumo.casados++;
            return;
        }
        String motivo = candidatos.isEmpty() ? "sem_match" : "ambiguo_" + candidatos.size();
        try (PreparedStatement upd = conn.prepareStatement(
                "UPDATE " + tabela + " SET cidade_legado = ? WHERE id = ?")) {
            upd.setString(1, cidade.trim());
            upd.setLong(2, id);
            upd.executeUpdate();
        }
        resumo.pendentes++;
        pendentes.add(new String[] {tabela, String.valueOf(id), cidade, uf != null ? uf : "", motivo});
    }

    private static void sincronizarDerivados(Connection conn, String tabela, long id, int municipioId) throws Exception {
        if ("pessoa_endereco".equals(tabela)) {
            try (PreparedStatement ps = conn.prepareStatement(
                    """
                    UPDATE pessoa_endereco pe
                    JOIN municipio m ON m.id = ?
                    JOIN estado e ON e.id = m.uf_id
                    SET pe.cidade = m.nome, pe.estado = e.sigla
                    WHERE pe.id = ?
                    """)) {
                ps.setInt(1, municipioId);
                ps.setLong(2, id);
                ps.executeUpdate();
            }
        } else if ("processo".equals(tabela)) {
            try (PreparedStatement ps = conn.prepareStatement(
                    """
                    UPDATE processo p
                    JOIN municipio m ON m.id = ?
                    JOIN estado e ON e.id = m.uf_id
                    SET p.cidade = m.nome, p.uf = e.sigla
                    WHERE p.id = ?
                    """)) {
                ps.setInt(1, municipioId);
                ps.setLong(2, id);
                ps.executeUpdate();
            }
        }
    }

    private static String chave(String nomeNorm, String uf) {
        return nomeNorm + "|" + (uf != null ? uf.toUpperCase(Locale.ROOT) : "");
    }

    private static void gravarRelatorio(List<String[]> pendentes, Resumo resumo) throws Exception {
        Path dir = Path.of("logs");
        Files.createDirectories(dir);
        Path csv = dir.resolve("migracao-municipio-pendentes.csv");
        try (BufferedWriter w = Files.newBufferedWriter(csv, StandardCharsets.UTF_8)) {
            w.write("tabela,id,cidade_texto,uf,motivo\n");
            for (String[] row : pendentes) {
                w.write(String.join(",", escape(row)) + "\n");
            }
        }
        System.out.printf(
                Locale.ROOT,
                "Migracao municipio: casados=%d pendentes=%d relatorio=%s%n",
                resumo.casados,
                resumo.pendentes,
                csv.toAbsolutePath());
    }

    private static String[] escape(String[] row) {
        String[] out = new String[row.length];
        for (int i = 0; i < row.length; i++) {
            String v = row[i] == null ? "" : row[i];
            if (v.contains(",") || v.contains("\"")) {
                v = "\"" + v.replace("\"", "\"\"") + "\"";
            }
            out[i] = v;
        }
        return out;
    }

    private static final class Resumo {
        int casados;
        int pendentes;
    }
}
