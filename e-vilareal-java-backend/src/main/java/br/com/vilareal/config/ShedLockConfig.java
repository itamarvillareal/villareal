package br.com.vilareal.config;

import net.javacrumbs.shedlock.core.DefaultLockingTaskExecutor;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

/**
 * Infraestrutura do ShedLock para travar jobs {@code @Scheduled} que não podem
 * rodar em paralelo (ex.: futuro acesso autenticado a tribunal).
 *
 * <p>Apenas habilita o mecanismo; nenhum job recebe {@code @SchedulerLock} ainda.
 * Para travar um job, anote-o com
 * {@code @SchedulerLock(name = "...", lockAtMostFor = "...", lockAtLeastFor = "...")}.</p>
 *
 * <p>{@code defaultLockAtMostFor} é a salvaguarda: se o nó que segura o lock
 * morrer sem liberá-lo, o lock expira após esse tempo.</p>
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")
public class ShedLockConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(
                JdbcTemplateLockProvider.Configuration.builder()
                        .withJdbcTemplate(new JdbcTemplate(dataSource))
                        // Usa o relógio do banco (evita problemas de clock skew entre nós).
                        .usingDbTime()
                        .build());
    }

    @Bean
    public LockingTaskExecutor lockingTaskExecutor(LockProvider lockProvider) {
        return new DefaultLockingTaskExecutor(lockProvider);
    }
}
