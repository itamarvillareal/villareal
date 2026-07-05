package br.com.vilareal.assinador.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

final class AssinadorSecretComparator {

    private AssinadorSecretComparator() {}

    static boolean secretsIguais(String esperado, String recebido) {
        if (esperado == null || recebido == null) {
            return false;
        }
        byte[] a = esperado.getBytes(StandardCharsets.UTF_8);
        byte[] b = recebido.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }
}
