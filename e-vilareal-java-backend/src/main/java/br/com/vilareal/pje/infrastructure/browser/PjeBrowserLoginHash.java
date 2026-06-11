package br.com.vilareal.pje.infrastructure.browser;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Hash curto do login para nomes de artefatos — nunca persiste/login em claro nos ficheiros. */
final class PjeBrowserLoginHash {

    private PjeBrowserLoginHash() {}

    static String hash8(String login) {
        if (login == null || login.isBlank()) {
            return "anon";
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(login.trim().getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 4; i++) {
                sb.append(String.format("%02x", hash[i]));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            return "hasherr";
        }
    }
}
