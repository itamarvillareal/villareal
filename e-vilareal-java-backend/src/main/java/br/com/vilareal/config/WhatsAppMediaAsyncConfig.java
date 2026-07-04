package br.com.vilareal.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class WhatsAppMediaAsyncConfig {

    @Bean(name = "whatsappMediaExecutor")
    public TaskExecutor whatsappMediaExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("whatsapp-media-");
        executor.initialize();
        return executor;
    }
}
