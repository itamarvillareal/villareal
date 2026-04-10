package br.com.vilareal.db.migration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.NavigableSet;
import java.util.TreeSet;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * Garante {@code id = 2} para Karla e {@code id = 3} para Ana Luísa (logins conhecidos do seed).
 * Atualiza FKs via {@code ON UPDATE CASCADE}. Se os utilizadores não existirem, não faz nada.
 */
public class V24__UsuarioKarla2AnaLuisa3 extends BaseJavaMigration {

    private static final String[] KARLA_LOGINS = {"karla.pedroza", "karla.pedroza@villarealadvocacia.adv.br"};
    private static final String ANA_LOGIN = "analuisanunesdabadia@gmail.com";

    @Override
    public void migrate(Context context) throws Exception {
        Connection c = context.getConnection();
        Long kId = findUsuarioIdByLogins(c, KARLA_LOGINS);
        Long aId = findUsuarioIdByLogin(c, ANA_LOGIN);
        if (kId == null || aId == null) {
            return;
        }
        if (kId == 2L && aId == 3L) {
            return;
        }

        long maxId;
        try (PreparedStatement ps = c.prepareStatement("SELECT COALESCE(MAX(id), 0) FROM usuarios");
                ResultSet rs = ps.executeQuery()) {
            rs.next();
            maxId = rs.getLong(1);
        }
        long tmpBase = maxId + 100_000L;

        NavigableSet<Long> distinct = new TreeSet<>(Comparator.reverseOrder());
        distinct.add(2L);
        distinct.add(3L);
        distinct.add(kId);
        distinct.add(aId);

        int i = 0;
        for (Long id : distinct) {
            try (PreparedStatement ps = c.prepareStatement("UPDATE usuarios SET id = ? WHERE id = ?")) {
                ps.setLong(1, tmpBase + i);
                ps.setLong(2, id);
                ps.executeUpdate();
            }
            i++;
        }
        int moved = i;

        try (PreparedStatement ps =
                c.prepareStatement("UPDATE usuarios SET id = 2 WHERE login IN ('karla.pedroza', 'karla.pedroza@villarealadvocacia.adv.br')")) {
            ps.executeUpdate();
        }
        try (PreparedStatement ps = c.prepareStatement("UPDATE usuarios SET id = 3 WHERE login = ?")) {
            ps.setString(1, ANA_LOGIN);
            ps.executeUpdate();
        }

        NavigableSet<Long> freeSlots = new TreeSet<>();
        for (Long x : distinct) {
            if (x != 2L && x != 3L) {
                freeSlots.add(x);
            }
        }

        List<Long> leftover = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement("SELECT id FROM usuarios WHERE id >= ? AND id < ? ORDER BY id")) {
            ps.setLong(1, tmpBase);
            ps.setLong(2, tmpBase + moved);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    leftover.add(rs.getLong(1));
                }
            }
        }

        List<Long> freeList = new ArrayList<>(freeSlots);
        Collections.sort(freeList);
        if (leftover.size() != freeList.size()) {
            throw new IllegalStateException(
                    "V24: incompatível leftover=" + leftover.size() + " vs slots livres=" + freeList.size());
        }
        for (int j = 0; j < leftover.size(); j++) {
            try (PreparedStatement ps = c.prepareStatement("UPDATE usuarios SET id = ? WHERE id = ?")) {
                ps.setLong(1, freeList.get(j));
                ps.setLong(2, leftover.get(j));
                ps.executeUpdate();
            }
        }
    }

    private static Long findUsuarioIdByLogins(Connection c, String[] logins) throws Exception {
        if (logins.length == 0) {
            return null;
        }
        StringBuilder in = new StringBuilder();
        for (int i = 0; i < logins.length; i++) {
            in.append(i == 0 ? "?" : ", ?");
        }
        String sql = "SELECT id FROM usuarios WHERE login IN (" + in + ") ORDER BY id LIMIT 1";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < logins.length; i++) {
                ps.setString(i + 1, logins[i]);
            }
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getLong(1) : null;
            }
        }
    }

    private static Long findUsuarioIdByLogin(Connection c, String login) throws Exception {
        try (PreparedStatement ps = c.prepareStatement("SELECT id FROM usuarios WHERE login = ? ORDER BY id LIMIT 1")) {
            ps.setString(1, login);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getLong(1) : null;
            }
        }
    }
}
