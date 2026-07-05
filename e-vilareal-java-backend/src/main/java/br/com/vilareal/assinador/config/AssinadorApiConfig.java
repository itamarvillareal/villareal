package br.com.vilareal.assinador.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(AssinadorApiProperties.class)
public class AssinadorApiConfig {}
