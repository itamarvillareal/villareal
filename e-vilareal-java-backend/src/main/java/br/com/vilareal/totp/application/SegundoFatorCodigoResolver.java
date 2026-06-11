package br.com.vilareal.totp.application;

import br.com.vilareal.totp.domain.TipoSegundoFator;
import br.com.vilareal.totp.domain.TribunalIntegracao;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Fachada para o robô: resolve o tipo de 2FA do tribunal e delega ao provider adequado.
 * Cobre tribunais com {@link TipoSegundoFator#TOTP_APP} (ex.: PJe TRT18).
 */
@Service
public class SegundoFatorCodigoResolver {

    private final List<SegundoFatorCodigoProvider> providers;

    public SegundoFatorCodigoResolver(List<SegundoFatorCodigoProvider> providers) {
        this.providers = providers;
    }

    public TipoSegundoFator tipoSegundoFator(TribunalIntegracao tribunal) {
        if (tribunal == null) {
            return TipoSegundoFator.NENHUM;
        }
        return tribunal.tipoSegundoFator();
    }

    /**
     * Código TOTP quando o tribunal usa app autenticador; vazio para EMAIL/NENHUM.
     */
    public Optional<String> obterCodigoTotpSeAplicavel(TribunalIntegracao tribunal, String login) {
        if (tribunal == null || tribunal.tipoSegundoFator() != TipoSegundoFator.TOTP_APP) {
            return Optional.empty();
        }
        for (SegundoFatorCodigoProvider provider : providers) {
            if (provider.suporta(tribunal)) {
                Optional<String> codigo = provider.obterCodigo(tribunal, login);
                if (codigo.isPresent()) {
                    return codigo;
                }
            }
        }
        return Optional.empty();
    }

    public Optional<String> obterCodigoTotpPorCredencialId(Long credencialTotpId) {
        for (SegundoFatorCodigoProvider provider : providers) {
            Optional<String> codigo = provider.obterCodigoPorCredencialId(credencialTotpId);
            if (codigo.isPresent()) {
                return codigo;
            }
        }
        return Optional.empty();
    }
}
