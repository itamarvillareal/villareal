package br.com.vilareal.api.config;

import br.com.vilareal.api.context.UsuarioContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Lê cabeçalhos enviados pelo front (sessão local) e disponibiliza usuário + IP para serviços e auditoria.
 */
@Component
@Order(0)
public class UsuarioContextFilter extends OncePerRequestFilter {

    public static final String HEADER_USUARIO_ID = "X-VilaReal-Usuario-Id";
    public static final String HEADER_USUARIO_NOME_B64 = "X-VilaReal-Usuario-Nome-B64";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String uid = trimToNull(request.getHeader(HEADER_USUARIO_ID));
            String nomeB64 = trimToNull(request.getHeader(HEADER_USUARIO_NOME_B64));
            String nome = decodeNomeB64(nomeB64);
            String ip = primeiroIp(request.getHeader("X-Forwarded-For"));
            if (ip == null) {
                ip = request.getRemoteAddr();
            }
            UsuarioContext.set(uid, nome, ip);
            filterChain.doFilter(request, response);
        } finally {
            UsuarioContext.clear();
        }
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String primeiroIp(String forwarded) {
        if (forwarded == null || forwarded.isBlank()) return null;
        String[] partes = forwarded.split(",");
        return partes[0].trim();
    }

    private static String decodeNomeB64(String b64) {
        if (b64 == null || b64.isBlank()) return null;
        try {
            byte[] raw = Base64.getDecoder().decode(b64.trim());
            return new String(raw, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
