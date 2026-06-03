package br.com.vilareal.email;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ProjudiMovimentacoesEmailPipelineProperties.class)
public class ProjudiMovimentacoesEmailPipelineConfiguration {}
