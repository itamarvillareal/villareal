package br.com.vilareal.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.util.List;

/**
 * Expõe o esquema Bearer JWT no Swagger UI (botão &quot;Authorize&quot;).
 * Login permanece público via {@link OpenApiCustomizer}.
 */
@Configuration
@Profile("dev")
public class OpenApiConfig {

    public static final String BEARER_JWT = "bearer-jwt";

    @Bean
    public OpenAPI vilarealOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("VilaReal API")
                        .description("API REST — autentique com **Authorize** usando o `accessToken` de `POST /api/auth/login`.")
                        .version("1.0"))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_JWT))
                .components(new Components().addSecuritySchemes(BEARER_JWT,
                        new SecurityScheme()
                                .name(BEARER_JWT)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Cole somente o token (sem o prefixo \"Bearer \").")));
    }

    @Bean
    public OpenApiCustomizer loginPublicCustomizer() {
        return openApi -> {
            var pathItem = openApi.getPaths() != null ? openApi.getPaths().get("/api/auth/login") : null;
            if (pathItem != null && pathItem.getPost() != null) {
                pathItem.getPost().setSecurity(List.of());
            }
        };
    }
}
