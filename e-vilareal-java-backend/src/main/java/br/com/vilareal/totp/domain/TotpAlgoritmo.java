package br.com.vilareal.totp.domain;

import dev.samstevens.totp.code.HashingAlgorithm;

/**
 * Algoritmo HMAC aceito na otpauth URI (RFC 6238).
 */
public enum TotpAlgoritmo {
    SHA1(HashingAlgorithm.SHA1),
    SHA256(HashingAlgorithm.SHA256),
    SHA512(HashingAlgorithm.SHA512);

    private final HashingAlgorithm hashingAlgorithm;

    TotpAlgoritmo(HashingAlgorithm hashingAlgorithm) {
        this.hashingAlgorithm = hashingAlgorithm;
    }

    public HashingAlgorithm hashingAlgorithm() {
        return hashingAlgorithm;
    }

    public static TotpAlgoritmo padrao() {
        return SHA1;
    }

    public static TotpAlgoritmo fromOtpauth(String valor) {
        if (valor == null || valor.isBlank()) {
            return padrao();
        }
        String norm = valor.trim().toUpperCase().replace("-", "");
        for (TotpAlgoritmo a : values()) {
            if (a.name().equals(norm)) {
                return a;
            }
        }
        throw new IllegalArgumentException("Algoritmo TOTP não suportado: " + valor);
    }
}
