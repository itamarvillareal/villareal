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
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
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
        String recebido = request.getHeader(AssinadorSecurityConstants.HEADER_SECRET);
        logDebugComparacao(request, configurado, recebido);
        if (!StringUtils.hasText(configurado)) {
            log.error("assinador_api_auth configuracao_ausente path={}", request.getRequestURI());
            response.sendError(HttpStatus.SERVICE_UNAVAILABLE.value(), "Assinador API não configurada (ASSINADOR_API_SECRET ausente).");
            return;
        }

        if (!StringUtils.hasText(recebido)) {
            log.warn("assinador_api_auth ausente path={} ip={}", request.getRequestURI(), request.getRemoteAddr());
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "Header X-Assinador-Secret é obrigatório.");
            return;
        }
        String esperadoTrim = configurado.trim();
        String recebidoTrim = recebido.trim();
        if (!AssinadorSecretComparator.secretsIguais(esperadoTrim, recebidoTrim)) {
            log.warn("assinador_api_auth invalido path={} ip={}", request.getRequestURI(), request.getRemoteAddr());
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "Segredo do assinador inválido.");
            return;
        }

        String assinadorId = request.getHeader(AssinadorSecurityConstants.HEADER_ASSINADOR_ID);
        if (!StringUtils.hasText(assinadorId)) {
            log.warn("assinador_api_auth assinador_id_ausente path={} ip={}", request.getRequestURI(), request.getRemoteAddr());
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "Header X-Assinador-Id é obrigatório.");
            return;
        }

        var auth = new UsernamePasswordAuthenticationToken(
                assinadorId.trim(),
                null,
                List.of(new SimpleGrantedAuthority(AssinadorSecurityConstants.ROLE_ASSINADOR)));
        SecurityContextHolder.getContext().setAuthentication(auth);
        filterChain.doFilter(request, response);
    }

    /** Long-poll usa DeferredResult — o dispatch ASYNC reavalia o AuthorizationFilter; reautenticar aqui. */
    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return false;
    }

    /** TEMPORÁRIO — diagnóstico de mismatch de segredo; remover após E2E OK. */
    private void logDebugComparacao(HttpServletRequest request, String configurado, String recebido) {
        if (!log.isDebugEnabled()) {
            return;
        }
        String esperado = configurado != null ? configurado.trim() : null;
        String header = recebido != null ? recebido.trim() : null;
        boolean iguais = AssinadorSecretComparator.secretsIguais(esperado, header);
        log.debug(
                "assinador_api_auth_compare path={} esperadoVazio={} esperadoLen={} recebidoLen={} iguais={} "
                        + "esperadoPontas={} recebidoPontas={} esperadoSha256={} recebidoSha256={}",
                request.getRequestURI(),
                !StringUtils.hasText(esperado),
                esperado != null ? esperado.length() : 0,
                header != null ? header.length() : 0,
                iguais,
                pontasSegredo(esperado),
                pontasSegredo(header),
                sha256Hex(esperado),
                sha256Hex(header));
    }

    private static String pontasSegredo(String valor) {
        if (valor == null) {
            return "null";
        }
        if (valor.isEmpty()) {
            return "[]";
        }
        if (valor.length() <= 6) {
            return "[" + valor + "]";
        }
        return valor.substring(0, 3) + "…" + valor.substring(valor.length() - 3);
    }

    private static String sha256Hex(String valor) {
        if (valor == null) {
            return "null";
        }
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(valor.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            return "erro-sha256";
        }
    }
}
