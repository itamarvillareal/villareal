package br.com.vilareal.support;

import org.testcontainers.containers.MySQLContainer;

/**
 * Container MySQL único para toda a suíte de integração (evita start/stop por classe de teste).
 */
public final class IntegrationTestMysql {

    // collation-server alinhada ao default da database de produção (utf8mb4_unicode_ci): garante que a
    // DB de teste nasça com a mesma collation que prod, para que migrations sem COLLATE explícito (ex.:
    // financeiro_lancamento na V7) não conflitem em UNIONs com tabelas que fixam utf8mb4_unicode_ci (V116).
    public static final MySQLContainer<?> CONTAINER =
            new MySQLContainer<>("mysql:8.0.36")
                    .withDatabaseName("vilareal_test")
                    .withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci");

    private static volatile boolean started;

    private IntegrationTestMysql() {}

    public static void ensureStarted() {
        if (!started) {
            synchronized (IntegrationTestMysql.class) {
                if (!started) {
                    CONTAINER.start();
                    started = true;
                }
            }
        }
    }
}
