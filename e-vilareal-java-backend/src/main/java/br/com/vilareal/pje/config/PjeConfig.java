package br.com.vilareal.pje.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
@EnableConfigurationProperties(PjeCopiaIntegralFalhaEmailProperties.class)
public class PjeConfig {

    @Bean(name = "pjeEmailTriggerExecutor", destroyMethod = "shutdown")
    public ExecutorService pjeEmailTriggerExecutor() {
        return Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "pje-email-trigger");
            t.setDaemon(true);
            return t;
        });
    }
}
