package br.com.vilareal.totp.application;

import br.com.vilareal.totp.domain.TotpAlgoritmo;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Interpreta otpauth URI ou secret Base32 cru.
 */
public final class OtpauthParser {

    private static final Pattern BASE32 = Pattern.compile("^[A-Z2-7]+=*$");
    private static final int DIGITOS_PADRAO = 6;
    private static final int PERIODO_PADRAO = 30;

    private OtpauthParser() {
    }

    public record OtpauthDados(
            String secretBase32,
            TotpAlgoritmo algoritmo,
            int digitos,
            int periodoSegundos,
            String issuer,
            String accountName) {}

    public static OtpauthDados parse(String entrada) {
        if (entrada == null || entrada.isBlank()) {
            throw new IllegalArgumentException("Informe a otpauth URI ou o secret Base32.");
        }
        String raw = entrada.trim();
        if (raw.toLowerCase(Locale.ROOT).startsWith("otpauth://")) {
            return parseUri(raw);
        }
        return parseSecretCru(raw);
    }

    private static OtpauthDados parseUri(String uri) {
        URI parsed;
        try {
            parsed = URI.create(uri);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("otpauth URI inválida.", e);
        }
        if (!"otpauth".equalsIgnoreCase(parsed.getScheme())) {
            throw new IllegalArgumentException("Esquema otpauth esperado.");
        }
        String tipo = parsed.getHost();
        if (tipo == null || !"totp".equalsIgnoreCase(tipo)) {
            throw new IllegalArgumentException("Somente otpauth://totp/ é suportado.");
        }

        String path = parsed.getPath();
        String label = path != null && path.length() > 1 ? URLDecoder.decode(path.substring(1), StandardCharsets.UTF_8) : null;
        Map<String, String> params = parseQuery(parsed.getRawQuery());

        String secret = normalizarSecret(params.get("secret"));
        if (secret == null) {
            throw new IllegalArgumentException("Parâmetro secret ausente na otpauth URI.");
        }

        TotpAlgoritmo algoritmo = TotpAlgoritmo.fromOtpauth(params.get("algorithm"));
        int digitos = parseInteiroPositivo(params.get("digits"), DIGITOS_PADRAO, 6, 10);
        int periodo = parseInteiroPositivo(params.get("period"), PERIODO_PADRAO, 15, 120);

        String issuer = textoOuNull(params.get("issuer"));
        String accountName = extrairAccountName(label, issuer);

        return new OtpauthDados(secret, algoritmo, digitos, periodo, issuer, accountName);
    }

    private static OtpauthDados parseSecretCru(String secretCru) {
        String secret = normalizarSecret(secretCru);
        if (secret == null) {
            throw new IllegalArgumentException("Secret Base32 inválido.");
        }
        return new OtpauthDados(secret, TotpAlgoritmo.padrao(), DIGITOS_PADRAO, PERIODO_PADRAO, null, null);
    }

    static String normalizarSecret(String secret) {
        if (secret == null || secret.isBlank()) {
            return null;
        }
        String norm = secret.trim().replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
        if (!BASE32.matcher(norm).matches() || norm.length() < 8) {
            return null;
        }
        return norm;
    }

    private static Map<String, String> parseQuery(String rawQuery) {
        Map<String, String> out = new LinkedHashMap<>();
        if (rawQuery == null || rawQuery.isBlank()) {
            return out;
        }
        for (String par : rawQuery.split("&")) {
            int eq = par.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            String chave = URLDecoder.decode(par.substring(0, eq), StandardCharsets.UTF_8);
            String valor = URLDecoder.decode(par.substring(eq + 1), StandardCharsets.UTF_8);
            out.put(chave.toLowerCase(Locale.ROOT), valor);
        }
        return out;
    }

    private static int parseInteiroPositivo(String valor, int padrao, int min, int max) {
        if (valor == null || valor.isBlank()) {
            return padrao;
        }
        int n = Integer.parseInt(valor.trim());
        if (n < min || n > max) {
            throw new IllegalArgumentException("Valor fora do intervalo permitido: " + valor);
        }
        return n;
    }

    private static String extrairAccountName(String label, String issuer) {
        if (label == null || label.isBlank()) {
            return null;
        }
        int sep = label.indexOf(':');
        if (sep >= 0 && sep < label.length() - 1) {
            return label.substring(sep + 1).trim();
        }
        if (issuer != null && label.equalsIgnoreCase(issuer)) {
            return null;
        }
        return label.trim();
    }

    private static String textoOuNull(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }
}
