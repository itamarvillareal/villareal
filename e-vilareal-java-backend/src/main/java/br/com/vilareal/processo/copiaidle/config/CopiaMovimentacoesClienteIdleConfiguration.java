package br.com.vilareal.processo.copiaidle.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(CopiaMovimentacoesClienteIdleProperties.class)
public class CopiaMovimentacoesClienteIdleConfiguration {}
