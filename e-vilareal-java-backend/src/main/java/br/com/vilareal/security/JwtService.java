package br.com.vilareal.security;

import br.com.vilareal.config.SecurityProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {

    private final SecurityProperties props;

    public JwtService(SecurityProperties props) {
        this.props = props;
    }

    public String generateToken(Long usuarioId, String login) {
        String sub = login == null ? "" : login.trim().toLowerCase();
        Date now = new Date();
        Date exp = new Date(now.getTime() + props.getExpirationMs());
        return Jwts.builder()
                .claims(Map.of("uid", usuarioId, "sub", sub))
                .subject(sub)
                .issuedAt(now)
                .expiration(exp)
                .signWith(signingKey())
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(signingKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Long extractUsuarioId(String token) {
        Object uid = parse(token).get("uid");
        if (uid instanceof Number n) {
            return n.longValue();
        }
        throw new IllegalArgumentException("Token inválido.");
    }

    private SecretKey signingKey() {
        byte[] keyBytes = props.getSecret().getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
