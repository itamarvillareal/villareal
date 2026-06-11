package br.com.vilareal.totp.application;

import br.com.vilareal.totp.domain.TipoSegundoFator;
import br.com.vilareal.totp.domain.TribunalIntegracao;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SegundoFatorCodigoResolverTest {

    @Test
    void pjeTrt18UsaTotpApp() {
        SegundoFatorCodigoResolver resolver = new SegundoFatorCodigoResolver(List.of());
        assertThat(resolver.tipoSegundoFator(TribunalIntegracao.PJE_TRT18))
                .isEqualTo(TipoSegundoFator.TOTP_APP);
    }

    @Test
    void pjeTrt18DelegaAoProviderTotp() {
        SegundoFatorCodigoProvider provider = mock(SegundoFatorCodigoProvider.class);
        when(provider.suporta(TribunalIntegracao.PJE_TRT18)).thenReturn(true);
        when(provider.obterCodigo(any(), any())).thenReturn(Optional.of("123456"));

        SegundoFatorCodigoResolver resolver = new SegundoFatorCodigoResolver(List.of(provider));
        assertThat(resolver.obterCodigoTotpSeAplicavel(TribunalIntegracao.PJE_TRT18, "00733235190"))
                .contains("123456");
    }

    @Test
    void pjeTjprDelegaAoProviderTotp() {
        SegundoFatorCodigoProvider provider = mock(SegundoFatorCodigoProvider.class);
        when(provider.suporta(TribunalIntegracao.PJE_TJPR)).thenReturn(true);
        when(provider.obterCodigo(any(), any())).thenReturn(Optional.of("654321"));

        SegundoFatorCodigoResolver resolver = new SegundoFatorCodigoResolver(List.of(provider));
        assertThat(resolver.tipoSegundoFator(TribunalIntegracao.PJE_TJPR))
                .isEqualTo(TipoSegundoFator.TOTP_APP);
        assertThat(resolver.obterCodigoTotpSeAplicavel(TribunalIntegracao.PJE_TJPR, "00733235190"))
                .contains("654321");
    }
}
