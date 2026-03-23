package br.com.vilareal.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class VilaRealApplication {

	public static void main(String[] args) {
		SpringApplication.run(VilaRealApplication.class, args);
	}

}
