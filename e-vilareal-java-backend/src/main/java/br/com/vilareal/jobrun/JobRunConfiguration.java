package br.com.vilareal.jobrun;

import br.com.vilareal.jobrun.application.JobRunProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(JobRunProperties.class)
public class JobRunConfiguration {}
