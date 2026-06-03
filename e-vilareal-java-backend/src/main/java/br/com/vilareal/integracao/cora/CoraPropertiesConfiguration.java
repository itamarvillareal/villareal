package br.com.vilareal.integracao.cora;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Binding de {@link CoraProperties} mesmo com integração desligada (leitura de {@code cora.enabled}). */
@Configuration
@EnableConfigurationProperties(CoraProperties.class)
public class CoraPropertiesConfiguration {}
