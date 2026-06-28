package br.com.vilareal.db.migration;

import br.com.vilareal.localidade.domain.MunicipioTextoUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * Seed idempotente de estado/município a partir de {@code seeds/municipios-ibge.json}.
 */
public final class IbgeSeedSupport {

    private static final int FAVORITO_ANAPOLIS = 5201108;
    private static final int FAVORITO_GOIANIA = 5208707;

    private IbgeSeedSupport() {}

    public static void executar(Connection conn) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        try (InputStream in = IbgeSeedSupport.class.getClassLoader().getResourceAsStream("seeds/municipios-ibge.json")) {
            if (in == null) {
                throw new IllegalStateException("Arquivo seeds/municipios-ibge.json não encontrado no classpath.");
            }
            JsonNode root = mapper.readTree(in);
            if (!root.isArray()) {
                throw new IllegalStateException("seeds/municipios-ibge.json deve ser um array JSON.");
            }
            Map<Integer, UfRow> ufs = new HashMap<>();
            Iterator<JsonNode> it = root.elements();
            while (it.hasNext()) {
                JsonNode m = it.next();
                UfRow uf = extrairUf(m);
                if (uf != null) {
                    ufs.putIfAbsent(uf.id(), uf);
                }
            }
            upsertEstados(conn, ufs);
            upsertMunicipios(conn, root);
        }
    }

    private static UfRow extrairUf(JsonNode m) {
        JsonNode uf = null;
        JsonNode micro = m.get("microrregiao");
        if (micro != null && !micro.isNull()) {
            JsonNode meso = micro.get("mesorregiao");
            if (meso != null && !meso.isNull()) {
                uf = meso.get("UF");
            }
        }
        if (uf == null || uf.isNull()) {
            JsonNode imediata = m.get("regiao-imediata");
            if (imediata != null && !imediata.isNull()) {
                JsonNode inter = imediata.get("regiao-intermediaria");
                if (inter != null && !inter.isNull()) {
                    uf = inter.get("UF");
                }
            }
        }
        if (uf == null || uf.isNull()) {
            return null;
        }
        return new UfRow(uf.get("id").asInt(), uf.get("sigla").asText(), uf.get("nome").asText());
    }

    private static void upsertEstados(Connection conn, Map<Integer, UfRow> ufs) throws Exception {
        String sql =
                """
                INSERT INTO estado (id, sigla, nome) VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE sigla = VALUES(sigla), nome = VALUES(nome)
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (UfRow uf : ufs.values()) {
                ps.setInt(1, uf.id());
                ps.setString(2, uf.sigla());
                ps.setString(3, uf.nome());
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    private static void upsertMunicipios(Connection conn, JsonNode root) throws Exception {
        String sql =
                """
                INSERT INTO municipio (id, nome, nome_normalizado, uf_id, favorito, uso_count)
                VALUES (?, ?, ?, ?, ?, 0)
                ON DUPLICATE KEY UPDATE
                  nome = VALUES(nome),
                  nome_normalizado = VALUES(nome_normalizado),
                  uf_id = VALUES(uf_id),
                  favorito = VALUES(favorito)
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            Iterator<JsonNode> it = root.elements();
            while (it.hasNext()) {
                JsonNode m = it.next();
                UfRow uf = extrairUf(m);
                if (uf == null) {
                    continue;
                }
                int id = m.get("id").asInt();
                String nome = m.get("nome").asText();
                boolean favorito = id == FAVORITO_ANAPOLIS || id == FAVORITO_GOIANIA;
                ps.setInt(1, id);
                ps.setString(2, nome);
                ps.setString(3, MunicipioTextoUtil.normalizarNome(nome));
                ps.setInt(4, uf.id());
                ps.setBoolean(5, favorito);
                ps.addBatch();
            }
            ps.executeBatch();
        }
        try (PreparedStatement check = conn.prepareStatement("SELECT COUNT(*) FROM municipio");
                ResultSet rs = check.executeQuery()) {
            rs.next();
            int count = rs.getInt(1);
            if (count < 5500) {
                throw new IllegalStateException("Seed IBGE incompleto: apenas " + count + " municípios.");
            }
        }
    }

    private record UfRow(int id, String sigla, String nome) {}
}
