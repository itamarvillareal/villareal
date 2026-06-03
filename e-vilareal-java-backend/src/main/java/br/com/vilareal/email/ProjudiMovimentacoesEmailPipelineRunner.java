package br.com.vilareal.email;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "vilareal.email.projudi.pipeline.enabled", havingValue = "true")
public class ProjudiMovimentacoesEmailPipelineRunner implements ApplicationRunner {

    private final ProjudiMovimentacoesEmailPipelineService pipelineService;

    public ProjudiMovimentacoesEmailPipelineRunner(ProjudiMovimentacoesEmailPipelineService pipelineService) {
        this.pipelineService = pipelineService;
    }

    @Override
    public void run(ApplicationArguments args) {
        pipelineService.iniciarLoopEmBackground();
    }
}
