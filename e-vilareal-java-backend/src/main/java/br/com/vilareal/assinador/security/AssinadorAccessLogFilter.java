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
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate-limit simples por IP + log estruturado de acesso aos endpoints do assinador (superfície exposta).
 */
@Component
public class AssinadorAccessLogFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(AssinadorAccessLogFilter.class);
    private static final long JANELA_MS = 60_000L;

    private final AssinadorApiProperties properties;
    private final Map<String, Deque<Long>> acessosPorIp = new ConcurrentHashMap<>();

    public AssinadorAccessLogFilter(AssinadorApiProperties properties) {
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
        String ip = resolverIp(request);
        if (limiteExcedido(ip)) {
            log.warn(
                    "assinador_api_rate_limit ip={} path={} method={}",
                    ip,
                    request.getRequestURI(),
                    request.getMethod());
            response.sendError(HttpStatus.TOO_MANY_REQUESTS.value(), "Muitas requisições ao assinador. Aguarde e tente novamente.");
            return;
        }
        registrarAcesso(ip);
        long inicio = System.currentTimeMillis();
        try {
            filterChain.doFilter(request, response);
        } finally {
            log.info(
                    "assinador_api ip={} method={} path={} status={} durationMs={} assinadorId={}",
                    ip,
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    System.currentTimeMillis() - inicio,
                    mascararId(request.getHeader(AssinadorSecurityConstants.HEADER_ASSINADOR_ID)));
        }
    }

    private boolean limiteExcedido(String ip) {
        int limite = Math.max(properties.rateLimitPerMinute(), 1);
        Deque<Long> fila = acessosPorIp.computeIfAbsent(ip, k -> new ArrayDeque<>());
        long agora = System.currentTimeMillis();
        synchronized (fila) {
            while (!fila.isEmpty() && agora - fila.peekFirst() > JANELA_MS) {
                fila.pollFirst();
            }
            return fila.size() >= limite;
        }
    }

    private void registrarAcesso(String ip) {
        Deque<Long> fila = acessosPorIp.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (fila) {
            fila.addLast(System.currentTimeMillis());
        }
    }

    private static String resolverIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }

    private static String mascararId(String assinadorId) {
        if (assinadorId == null || assinadorId.isBlank()) {
            return "-";
        }
        String t = assinadorId.trim();
        if (t.length() <= 8) {
            return t;
        }
        return t.substring(0, 8) + "…";
    }
}
