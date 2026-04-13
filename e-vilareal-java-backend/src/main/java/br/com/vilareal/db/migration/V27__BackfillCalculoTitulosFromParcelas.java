package br.com.vilareal.db.migration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * Rodadas antigas com dados só em {@code parcelas[]} e {@code titulos[]} vazio na mesma linha —
 * copia data/valor mínimos para a aba «Títulos» (paridade com {@code calculosTitulosParcelasSync.js}).
 */
public class V27__BackfillCalculoTitulosFromParcelas extends BaseJavaMigration {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public void migrate(Context context) throws Exception {
        Connection c = context.getConnection();
        try (PreparedStatement sel = c.prepareStatement("SELECT id, payload_json FROM calculo_rodada")) {
            try (ResultSet rs = sel.executeQuery()) {
                while (rs.next()) {
                    long id = rs.getLong(1);
                    String json = rs.getString(2);
                    if (json == null || json.isBlank()) {
                        continue;
                    }
                    ObjectNode root = (ObjectNode) MAPPER.readTree(json);
                    if (!backfillTitulosFromParcelas(root)) {
                        continue;
                    }
                    try (PreparedStatement up =
                            c.prepareStatement("UPDATE calculo_rodada SET payload_json = CAST(? AS JSON) WHERE id = ?")) {
                        up.setString(1, MAPPER.writeValueAsString(root));
                        up.setLong(2, id);
                        up.executeUpdate();
                    }
                }
            }
        }
    }

    /**
     * @return {@code true} se {@code root} foi alterado.
     */
    static boolean backfillTitulosFromParcelas(ObjectNode root) {
        JsonNode parcelasNode = root.get("parcelas");
        if (parcelasNode == null || !parcelasNode.isArray() || parcelasNode.isEmpty()) {
            return false;
        }
        ArrayNode parcelas = (ArrayNode) parcelasNode;

        ArrayNode titulos;
        if (root.has("titulos") && root.get("titulos").isArray()) {
            titulos = (ArrayNode) root.get("titulos").deepCopy();
        } else {
            titulos = MAPPER.createArrayNode();
        }

        boolean changed = false;
        for (int i = 0; i < parcelas.size(); i++) {
            JsonNode p = parcelas.get(i);
            if (p == null || !p.isObject()) {
                continue;
            }
            if (!nonBlank(p, "dataVencimento") && !nonBlank(p, "valorParcela")) {
                continue;
            }
            while (titulos.size() <= i) {
                titulos.addObject();
                changed = true;
            }
            JsonNode tNode = titulos.get(i);
            ObjectNode t = tNode != null && tNode.isObject() ? (ObjectNode) tNode.deepCopy() : MAPPER.createObjectNode();
            boolean rowChanged = false;
            if (!nonBlank(t, "valorInicial") && nonBlank(p, "valorParcela")) {
                t.set("valorInicial", p.get("valorParcela"));
                rowChanged = true;
            }
            if (!nonBlank(t, "dataVencimento") && nonBlank(p, "dataVencimento")) {
                t.set("dataVencimento", p.get("dataVencimento"));
                rowChanged = true;
            }
            if (rowChanged) {
                titulos.set(i, t);
                changed = true;
            }
        }
        if (!changed) {
            return false;
        }
        root.set("titulos", titulos);
        return true;
    }

    private static boolean nonBlank(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return false;
        }
        return !n.get(field).asText("").trim().isEmpty();
    }
}
