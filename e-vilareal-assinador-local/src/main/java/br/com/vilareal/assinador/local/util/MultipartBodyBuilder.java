package br.com.vilareal.assinador.local.util;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Monta corpo multipart/form-data para upload de .p7s. */
public final class MultipartBodyBuilder {

    private final String boundary;
    private final ByteArrayOutputStream out = new ByteArrayOutputStream();

    public MultipartBodyBuilder() {
        this.boundary = "----vilareal-" + UUID.randomUUID();
    }

    public MultipartBodyBuilder addFile(String fieldName, String filename, String contentType, byte[] content) {
        try {
            out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            out.write(("Content-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"" + filename + "\"\r\n")
                    .getBytes(StandardCharsets.UTF_8));
            out.write(("Content-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            out.write(content);
            out.write("\r\n".getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new IllegalStateException("Falha ao montar multipart", e);
        }
        return this;
    }

    public String contentType() {
        return "multipart/form-data; boundary=" + boundary;
    }

    public byte[] body() {
        try {
            out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Falha ao finalizar multipart", e);
        }
    }
}
