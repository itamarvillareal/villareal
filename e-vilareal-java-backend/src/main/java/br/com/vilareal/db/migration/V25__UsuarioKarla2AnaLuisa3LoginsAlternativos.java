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
 * Complementa {@link V24__UsuarioKarla2AnaLuisa3}: a V24 só reconhece Ana Luísa pelo login
 * {@code analuisanunesdabadia@gmail.com}. Em bases onde o login foi gravado como {@code ana.luisa},
 * a V24 não faz nada e Karla/Ana ficam com ids trocados (ex.: 2=Ana, 3=Karla).
 * <p>
 * Esta migração aplica a mesma realinhação, aceitando ambos os logins para Ana.
 * Idempotente: se já estiver Karla=2 e Ana=3, não altera.
 */
public class V25__UsuarioKarla2AnaLuisa3LoginsAlternativos extends BaseJavaMigration {

    private static final String[] KARLA_LOGINS = {"karla.pedroza", "karla.pedroza@villarealadvocacia.adv.br"};
    private static final String[] ANA_LOGINS = {"analuisanunesdabadia@gmail.com", "ana.luisa"};

    @Override
    public void migrate(Context context) throws Exception {
        Connection c = context.getConnection();
        Long kId = findUsuarioIdByLogins(c, KARLA_LOGINS);
        Long aId = findUsuarioIdByLogins(c, ANA_LOGINS);
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
        String anaIn = buildInClause(ANA_LOGINS.length);
        try (PreparedStatement ps = c.prepareStatement("UPDATE usuarios SET id = 3 WHERE login IN (" + anaIn + ")")) {
            for (int j = 0; j < ANA_LOGINS.length; j++) {
                ps.setString(j + 1, ANA_LOGINS[j]);
            }
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
                    "V25: incompatível leftover=" + leftover.size() + " vs slots livres=" + freeList.size());
        }
        for (int j = 0; j < leftover.size(); j++) {
            try (PreparedStatement ps = c.prepareStatement("UPDATE usuarios SET id = ? WHERE id = ?")) {
                ps.setLong(1, freeList.get(j));
                ps.setLong(2, leftover.get(j));
                ps.executeUpdate();
            }
        }
    }

    private static String buildInClause(int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) {
            if (i > 0) {
                sb.append(", ");
            }
            sb.append('?');
        }
        return sb.toString();
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
}
