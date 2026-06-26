package br.com.vilareal.projudi.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ProjudiProtocoloEmailProperties.class)
public class ProjudiProtocoloConfiguration {}
