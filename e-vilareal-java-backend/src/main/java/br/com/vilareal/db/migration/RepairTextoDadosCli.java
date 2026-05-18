package br.com.vilareal.db.migration;

import java.sql.DriverManager;

/**
 * CLI: {@code mvn -q exec:java -Dexec.mainClass=br.com.vilareal.db.migration.RepairTextoDadosCli}
 * Variáveis: JDBC_URL, JDBC_USER, JDBC_PASSWORD (defaults dev local).
 */
public final class RepairTextoDadosCli {

    public static void main(String[] args) throws Exception {
        String url = System.getenv().getOrDefault(
                "JDBC_URL",
                "jdbc:mysql://localhost:3306/vilareal?useSSL=false&allowPublicKeyRetrieval=true&characterEncoding=utf8&serverTimezone=UTC");
        String user = System.getenv().getOrDefault("JDBC_USER", "root");
        String pass = System.getenv().getOrDefault("JDBC_PASSWORD", "root");
        try (var conn = DriverManager.getConnection(url, user, pass)) {
            conn.setAutoCommit(false);
            MojibakeUtf8DadosRepair.executar(conn);
            conn.commit();
            System.out.println("RepairTextoDadosCli: concluído.");
        }
    }
}
