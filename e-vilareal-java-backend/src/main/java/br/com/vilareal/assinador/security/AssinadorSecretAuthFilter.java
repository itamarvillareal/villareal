package br.com.vilareal.assinador.security;

import br.com.vilareal.assinador.AssinadorSecurityConstants;
import br.com.vilareal.assinador.config.AssinadorApiProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class AssinadorSecretAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(AssinadorSecretAuthFilter.class);

    private final AssinadorApiProperties properties;

    public AssinadorSecretAuthFilter(AssinadorApiProperties properties) {
        this.properties = properties;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getRequestURI();
        return path == null || !path.startsWith(AssinadorSecurityConstants.API_PREFIX);
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        String configurado = properties.secret();
        if (!StringUtils.hasText(configurado)) {
            log.error("assinador_api_auth configuracao_ausente path={}", request.getRequestURI());
            response.sendError(HttpStatus.SERVICE_UNAVAILABLE.value(), "Assinador API não configurada (ASSINADOR_API_SECRET ausente).");
            return;
        }

        String recebido = request.getHeader(AssinadorSecurityConstants.HEADER_SECRET);
        if (!StringUtils.hasText(recebido)) {
            log.warn("assinador_api_auth ausente path={} ip={}", request.getRequestURI(), request.getRemoteAddr());
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "Header X-Assinador-Secret é obrigatório.");
            return;
        }
        if (!AssinadorSecretComparator.secretsIguais(configurado.trim(), recebido.trim())) {
            log.warn("assinador_api_auth invalido path={} ip={}", request.getRequestURI(), request.getRemoteAddr());
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "Segredo do assinador inválido.");
            return;
        }

        var auth = new UsernamePasswordAuthenticationToken(
                "assinador-local",
                null,
                List.of(new SimpleGrantedAuthority(AssinadorSecurityConstants.ROLE_ASSINADOR)));
        SecurityContextHolder.getContext().setAuthentication(auth);
        try {
            filterChain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
