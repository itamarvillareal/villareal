package br.com.vilareal.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class ProjudiConfig {

    @Bean(name = "projudiEmailTriggerExecutor", destroyMethod = "shutdown")
    public ExecutorService projudiEmailTriggerExecutor() {
        return Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "projudi-email-trigger");
            t.setDaemon(true);
            return t;
        });
    }

    @Bean(name = "projudiEmailPipelineExecutor", destroyMethod = "shutdown")
    public ExecutorService projudiEmailPipelineExecutor() {
        return Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "projudi-email-pipeline");
            t.setDaemon(true);
            return t;
        });
    }
}
