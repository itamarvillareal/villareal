package br.com.vilareal.configuracao.application;

import br.com.vilareal.configuracao.api.dto.InstanciaIntegracoesResponse;
import br.com.vilareal.projudi.security.CredencialCryptoService;
import br.com.vilareal.totp.security.SegredoCipherService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;

@Service
public class ConfiguracoesIntegracoesService {

    private final CredencialCryptoService projudiCrypto;
    private final SegredoCipherService totpCipher;
    private final String instanciaId;
    private final String gmailUser;
    private final String gmailTokensDirectory;

    public ConfiguracoesIntegracoesService(
            CredencialCryptoService projudiCrypto,
            SegredoCipherService totpCipher,
            @Value("${VILLAREAL_INSTANCIA_ID:vilareal}") String instanciaId,
            @Value("${gmail.user:}") String gmailUser,
            @Value("${gmail.tokens.directory:}") String gmailTokensDirectory) {
        this.projudiCrypto = projudiCrypto;
        this.totpCipher = totpCipher;
        this.instanciaId = instanciaId == null || instanciaId.isBlank() ? "vilareal" : instanciaId.trim();
        this.gmailUser = gmailUser == null ? "" : gmailUser.trim();
        this.gmailTokensDirectory = gmailTokensDirectory == null ? "" : gmailTokensDirectory.trim();
    }

    public InstanciaIntegracoesResponse statusInstancia() {
        return new InstanciaIntegracoesResponse(
                instanciaId,
                rotuloInstancia(instanciaId),
                projudiCrypto.chaveConfigurada(),
                totpCipher.chaveConfigurada(),
                gmailUser.isBlank() ? null : gmailUser,
                gmailTokensConfigurados());
    }

    private static String rotuloInstancia(String id) {
        if ("portal1".equalsIgnoreCase(id)) {
            return "Portal 1 (FFM Advogados)";
        }
        if ("vilareal".equalsIgnoreCase(id)) {
            return "Portal Vila Real";
        }
        return id;
    }

    private boolean gmailTokensConfigurados() {
        if (gmailTokensDirectory.isBlank()) {
            return false;
        }
        try {
            Path dir = Path.of(gmailTokensDirectory);
            if (!Files.isDirectory(dir)) {
                return false;
            }
            try (var stream = Files.list(dir)) {
                return stream.findAny().isPresent();
            }
        } catch (Exception e) {
            return false;
        }
    }
}
