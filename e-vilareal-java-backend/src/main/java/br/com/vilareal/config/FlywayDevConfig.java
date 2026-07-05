package br.com.vilareal.config;

import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Em desenvolvimento, executa {@link Flyway#repair()} antes do migrate para remover entradas
 * de migração falha (ex.: SQL inválido) sem precisar apagar o schema manualmente.
 */
@Configuration
@Profile("dev")
public class FlywayDevConfig {

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            flyway.repair();
            flyway.migrate();
        };
    }
}
