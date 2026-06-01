package br.com.vilareal.db.migration;

import br.com.vilareal.agenda.application.AgendaConteudoKeyService;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;

/**
 * Passos idempotentes da V85: coluna nullable → backfill Java → dedup exato por chave → NOT NULL → UNIQUE.
 */
final class AgendaConteudoKeyMigrationHelper {

    private AgendaConteudoKeyMigrationHelper() {}

    static void executar(Connection conn) throws SQLException {
        garantirColunaNullable(conn);
        backfillConteudoKey(conn);
        removerDuplicatasExatasConteudoKey(conn);
        garantirNotNull(conn);
        garantirIndiceUnico(conn);
    }

    private static void garantirColunaNullable(Connection conn) throws SQLException {
        if (colunaExiste(conn, "conteudo_key")) {
            return;
        }
        try (Statement st = conn.createStatement()) {
            st.execute(
                    "ALTER TABLE agenda_evento ADD COLUMN conteudo_key VARCHAR(200) NULL AFTER origem");
        }
    }

    private static void backfillConteudoKey(Connection conn) throws SQLException {
        String select =
                """
                SELECT id, usuario_id, data_evento, hora_evento, descricao, status_curto
                FROM agenda_evento
                """;
        try (Statement st = conn.createStatement();
                ResultSet rs = st.executeQuery(select);
                PreparedStatement upd =
                        conn.prepareStatement("UPDATE agenda_evento SET conteudo_key = ? WHERE id = ?")) {
            int batch = 0;
            while (rs.next()) {
                long id = rs.getLong("id");
                long usuarioId = rs.getLong("usuario_id");
                LocalDate data = rs.getDate("data_evento").toLocalDate();
                String hora = rs.getString("hora_evento");
                String descricao = rs.getString("descricao");
                String status = rs.getString("status_curto");
                String key = AgendaConteudoKeyService.calcular(usuarioId, data, hora, descricao, status);
                if (key == null) {
                    throw new SQLException("conteudo_key nula para agenda_evento.id=" + id);
                }
                upd.setString(1, key);
                upd.setLong(2, id);
                upd.addBatch();
                batch++;
                if (batch >= 500) {
                    upd.executeBatch();
                    batch = 0;
                }
            }
            if (batch > 0) {
                upd.executeBatch();
            }
        }
    }

    /** Mantém o menor {@code id} por {@code conteudo_key} (rede de segurança antes do UNIQUE). */
    private static void removerDuplicatasExatasConteudoKey(Connection conn) throws SQLException {
        try (Statement st = conn.createStatement()) {
            st.execute(
                    """
                    DELETE ae FROM agenda_evento ae
                    INNER JOIN (
                        SELECT conteudo_key, MIN(id) AS keep_id
                        FROM agenda_evento
                        WHERE conteudo_key IS NOT NULL
                        GROUP BY conteudo_key
                        HAVING COUNT(*) > 1
                    ) dup ON ae.conteudo_key = dup.conteudo_key AND ae.id <> dup.keep_id
                    """);
        }
    }

    private static void garantirNotNull(Connection conn) throws SQLException {
        if (colunaNotNull(conn, "conteudo_key")) {
            return;
        }
        long nulos = contarNulos(conn);
        if (nulos > 0) {
            throw new SQLException(
                    "conteudo_key ainda NULL em " + nulos + " linha(s); backfill incompleto.");
        }
        try (Statement st = conn.createStatement()) {
            st.execute("ALTER TABLE agenda_evento MODIFY conteudo_key VARCHAR(200) NOT NULL");
        }
    }

    private static void garantirIndiceUnico(Connection conn) throws SQLException {
        if (indiceExiste(conn, "uq_agenda_evento_conteudo")) {
            return;
        }
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE UNIQUE INDEX uq_agenda_evento_conteudo ON agenda_evento (conteudo_key)");
        }
    }

    private static boolean colunaExiste(Connection conn, String coluna) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                """
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'agenda_evento'
                  AND column_name = ?
                """)) {
            ps.setString(1, coluna);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getInt(1) > 0;
            }
        }
    }

    private static boolean colunaNotNull(Connection conn, String coluna) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                """
                SELECT is_nullable FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'agenda_evento'
                  AND column_name = ?
                """)) {
            ps.setString(1, coluna);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && "NO".equalsIgnoreCase(rs.getString(1));
            }
        }
    }

    private static boolean indiceExiste(Connection conn, String nome) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                """
                SELECT COUNT(*) FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name = 'agenda_evento'
                  AND index_name = ?
                """)) {
            ps.setString(1, nome);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getInt(1) > 0;
            }
        }
    }

    private static long contarNulos(Connection conn) throws SQLException {
        try (Statement st = conn.createStatement();
                ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM agenda_evento WHERE conteudo_key IS NULL")) {
            rs.next();
            return rs.getLong(1);
        }
    }
}
