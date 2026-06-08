package br.com.vilareal.support;

import org.testcontainers.containers.MySQLContainer;

/**
 * Container MySQL único para toda a suíte de integração (evita start/stop por classe de teste).
 */
public final class IntegrationTestMysql {

    public static final MySQLContainer<?> CONTAINER =
            new MySQLContainer<>("mysql:8.0.36").withDatabaseName("vilareal_test");

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
