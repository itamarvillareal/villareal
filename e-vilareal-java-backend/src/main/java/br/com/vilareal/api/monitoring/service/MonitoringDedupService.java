package br.com.vilareal.api.monitoring.service;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Component
public class MonitoringDedupService {

    public String buildHash(long monitoredPersonId, String tribunal, String processNormalized,
                            String hitType, String lastMovementAt, String payloadFingerprint) {
        String raw = monitoredPersonId + "|" + nullSafe(tribunal) + "|" + nullSafe(processNormalized)
                + "|" + nullSafe(hitType) + "|" + nullSafe(lastMovementAt) + "|" + nullSafe(payloadFingerprint);
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] dig = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(dig);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s.trim().toUpperCase();
    }
}
