package br.com.vilareal.assinatura.keystore;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.Provider;
import java.security.Security;
import java.util.regex.Pattern;

/**
 * Inicializa o provider SunPKCS11 a partir de arquivo .cfg (SafeSign / Soluti no Windows).
 * Usa {@link Provider#configure(String)} (Java 9+) — compatível com Java 21.
 */
final class Pkcs11ProviderFactory {

    private static final String SUN_PKCS11 = "SunPKCS11";

    private static final Pattern SLOT_INDEX = Pattern.compile("(?m)^slotListIndex\\s*=\\s*\\d+\\s*$");

    private Pkcs11ProviderFactory() {}

    static Provider criar(Path cfgPath) {
        Provider base = Security.getProvider(SUN_PKCS11);
        if (base == null) {
            throw new IllegalStateException(
                    "Provider SunPKCS11 não disponível — use JDK 21 completo (módulo jdk.crypto.cryptoki)");
        }
        String cfg = cfgPath.toAbsolutePath().normalize().toString();
        Provider configured = base.configure(cfg);
        if (configured == null) {
            throw new IllegalStateException("falha ao configurar SunPKCS11 com arquivo: " + cfg);
        }
        return configured;
    }

    /**
     * Copia o .cfg do classpath para arquivo temporário, permitindo sobrescrever {@code slotListIndex}.
     */
    static Path materializarCfgClasspath(String resourcePath, int slotListIndex) throws IOException {
        String resource = resourcePath.startsWith("/") ? resourcePath.substring(1) : resourcePath;
        try (InputStream in = Pkcs11ProviderFactory.class.getClassLoader().getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException("Resource PKCS#11 ausente: " + resourcePath);
            }
            String texto = new String(in.readAllBytes(), StandardCharsets.US_ASCII);
            if (SLOT_INDEX.matcher(texto).find()) {
                texto = SLOT_INDEX.matcher(texto).replaceFirst("slotListIndex = " + slotListIndex);
            } else {
                texto = texto.stripTrailing() + System.lineSeparator() + "slotListIndex = " + slotListIndex
                        + System.lineSeparator();
            }
            Path destino = Files.createTempFile("pkcs11-soluti-", ".cfg");
            destino.toFile().deleteOnExit();
            Files.writeString(destino, texto, StandardCharsets.US_ASCII);
            return destino;
        }
    }
}
