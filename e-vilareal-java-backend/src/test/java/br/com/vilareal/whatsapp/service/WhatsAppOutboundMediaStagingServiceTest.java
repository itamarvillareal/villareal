package br.com.vilareal.whatsapp.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppOutboundMediaStagingServiceTest {

    @TempDir
    Path tempDir;

    private WhatsAppOutboundMediaStagingService stagingService;

    @BeforeEach
    void setUp() {
        stagingService = new WhatsAppOutboundMediaStagingService() {
            @Override
            Path getStagingDir() {
                return tempDir;
            }
        };
    }

    @Test
    void limparOrfaosAntigosRemoveSomenteArquivosVelhos() throws Exception {
        Path velho = tempDir.resolve("1_old.jpg");
        Path recente = tempDir.resolve("2_new.jpg");
        Files.write(velho, new byte[] {1});
        Files.write(recente, new byte[] {2});

        Files.setLastModifiedTime(velho, java.nio.file.attribute.FileTime.fromMillis(
                System.currentTimeMillis() - Duration.ofHours(48).toMillis()));

        int removidos = stagingService.limparOrfaosAntigos(Duration.ofHours(24));

        assertThat(removidos).isEqualTo(1);
        assertThat(Files.exists(velho)).isFalse();
        assertThat(Files.exists(recente)).isTrue();
    }
}
