package br.com.vilareal.assinador.security;

import br.com.vilareal.assinador.AssinadorSecurityConstants;
import br.com.vilareal.assinador.config.AssinadorApiProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Em produção (ou quando {@code assinador.api.require-https=true}), bloqueia HTTP puro nos endpoints
 * do assinador — o segredo {@link AssinadorSecurityConstants#HEADER_SECRET} não pode trafegar em claro.
 */
@Component
public class AssinadorHttpsEnforcementFilter extends OncePerRequestFilter {

    private final AssinadorApiProperties properties;

    public AssinadorHttpsEnforcementFilter(AssinadorApiProperties properties) {
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
        if (!properties.requireHttps()) {
            filterChain.doFilter(request, response);
            return;
        }
        if (requisicaoSegura(request)) {
            filterChain.doFilter(request, response);
            return;
        }
        response.sendError(
                HttpStatus.FORBIDDEN.value(),
                "Endpoints do assinador exigem HTTPS (TLS). Configure ASSINADOR_API_URL com https:// na máquina Windows.");
    }

    static boolean requisicaoSegura(HttpServletRequest request) {
        if (request.isSecure()) {
            return true;
        }
        String forwarded = request.getHeader("X-Forwarded-Proto");
        return forwarded != null && forwarded.equalsIgnoreCase("https");
    }
}
