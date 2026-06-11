package br.com.vilareal.totp.application;

import br.com.vilareal.totp.domain.TotpAlgoritmo;
import br.com.vilareal.totp.infrastructure.persistence.repository.CredencialTotpRepository;
import br.com.vilareal.totp.security.SegredoCipherService;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Vetor de teste RFC 6238 (Appendix B) — SHA1, 6 dígitos, período 30s.
 */
class TotpServiceRfc6238Test {

    /** Base32 do segredo ASCII RFC 6238 Appendix B ({@code 12345678901234567890}). */
    private static final String SECRET_BASE32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

    private final TotpService totpService = new TotpService(
            mock(CredencialTotpRepository.class),
            mock(SegredoCipherService.class),
            0);

    @Test
    void geraCodigoConformeRfc6238Tempo59() {
        String codigo = totpService.gerarCodigo(
                SECRET_BASE32,
                TotpAlgoritmo.SHA1,
                6,
                30,
                59L);
        assertThat(codigo).isEqualTo("287082");
        assertThat(totpService.gerarCodigo(
                SECRET_BASE32, TotpAlgoritmo.SHA1, 8, 30, 59L))
                .isEqualTo("94287082");
    }

    @Test
    void geraCodigoConformeRfc6238Tempo1111111109() {
        String codigo6 = totpService.gerarCodigo(
                SECRET_BASE32,
                TotpAlgoritmo.SHA1,
                6,
                30,
                1_111_111_109L);
        String codigo8 = totpService.gerarCodigo(
                SECRET_BASE32,
                TotpAlgoritmo.SHA1,
                8,
                30,
                1_111_111_109L);
        assertThat(codigo6).isEqualTo("081804");
        assertThat(codigo8).isEqualTo("07081804");
    }

    @Test
    void margemBordaAguardaProximoPeriodoQuandoRestamPoucosSegundos() {
        TotpService comMargem = new TotpService(
                mock(CredencialTotpRepository.class),
                mock(SegredoCipherService.class),
                3);
        long inicio = 57L;
        long resolvido = comMargem.resolverInstanteComMargem(inicio, 30);
        assertThat(resolvido).isGreaterThanOrEqualTo(60L);
    }
}
