package br.com.vilareal.config;

import br.com.vilareal.assinador.AssinadorSecurityConstants;
import br.com.vilareal.assinador.security.AssinadorAccessLogFilter;
import br.com.vilareal.assinador.security.AssinadorHttpsEnforcementFilter;
import br.com.vilareal.assinador.security.AssinadorSecretAuthFilter;
import br.com.vilareal.security.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Value("${vilareal.security.permit-all-requests:false}")
    private boolean permitAllRequests;

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final SecurityProblemSupport securityProblemSupport;
    private final AssinadorHttpsEnforcementFilter assinadorHttpsEnforcementFilter;
    private final AssinadorAccessLogFilter assinadorAccessLogFilter;
    private final AssinadorSecretAuthFilter assinadorSecretAuthFilter;

    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter,
            SecurityProblemSupport securityProblemSupport,
            AssinadorHttpsEnforcementFilter assinadorHttpsEnforcementFilter,
            AssinadorAccessLogFilter assinadorAccessLogFilter,
            AssinadorSecretAuthFilter assinadorSecretAuthFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.securityProblemSupport = securityProblemSupport;
        this.assinadorHttpsEnforcementFilter = assinadorHttpsEnforcementFilter;
        this.assinadorAccessLogFilter = assinadorAccessLogFilter;
        this.assinadorSecretAuthFilter = assinadorSecretAuthFilter;
    }

    @Bean
    public AuthenticationManager authenticationManager(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder) {
        var provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(c -> c.configurationSource(corsConfigurationSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll();
                    if (permitAllRequests) {
                        auth.anyRequest().permitAll();
                    } else {
                        auth.requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                                .requestMatchers("/api/webhook/whatsapp").permitAll()
                                // /api/whatsapp/media/* exige JWT (mesmo nível da inbox /api/whatsapp/*)
                                .requestMatchers(HttpMethod.POST, "/api/cora-sandbox/webhook").permitAll()
                                // Diagnóstico Drive exige admin autenticado (demais /admin PROJUDI ainda TEMP público)
                                .requestMatchers("/api/projudi/admin/drive-diag").hasAuthority("ROLE_ADMIN")
                                .requestMatchers("/api/admin/totp/**").hasAuthority("ROLE_ADMIN")
                                .requestMatchers("/api/admin/pje/**").hasAuthority("ROLE_ADMIN")
                                .requestMatchers("/api/admin/processos/**").hasAuthority("ROLE_ADMIN")
                                .requestMatchers("/api/financeiro/admin/**").hasAuthority("ROLE_ADMIN")
                                // TEMPORÁRIO - liberar diagnóstico PROJUDI - remover junto com ProjudiDiagnosticoController
                                .requestMatchers("/api/projudi/admin/**").permitAll()
                                .requestMatchers("/api/julia/admin/**").permitAll()
                                .requestMatchers(
                                        "/v3/api-docs/**",
                                        "/swagger-ui/**",
                                        "/swagger-ui.html"
                                ).permitAll()
                                .requestMatchers(AssinadorSecurityConstants.API_PREFIX + "/**")
                                .hasAuthority(AssinadorSecurityConstants.ROLE_ASSINADOR)
                                .anyRequest().authenticated();
                    }
                })
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(securityProblemSupport)
                        .accessDeniedHandler(securityProblemSupport))
                .addFilterBefore(assinadorHttpsEnforcementFilter, JwtAuthenticationFilter.class)
                .addFilterBefore(assinadorAccessLogFilter, JwtAuthenticationFilter.class)
                .addFilterBefore(assinadorSecretAuthFilter, JwtAuthenticationFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration c = new CorsConfiguration();
        // Credenciais + navegadores: localhost explícito evita falhas quando o front não usa apenas o proxy do Vite.
        c.setAllowedOriginPatterns(
                List.of("http://localhost:*", "http://127.0.0.1:*", "https://localhost:*", "https://127.0.0.1:*", "*"));
        c.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        c.setAllowedHeaders(List.of("*"));
        c.setExposedHeaders(List.of(HttpHeaders.AUTHORIZATION));
        c.setAllowCredentials(true);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", c);
        return source;
    }
}
