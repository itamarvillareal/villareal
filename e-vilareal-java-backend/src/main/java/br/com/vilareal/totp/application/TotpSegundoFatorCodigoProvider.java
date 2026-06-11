package br.com.vilareal.totp.application;

import br.com.vilareal.totp.domain.TipoSegundoFator;
import br.com.vilareal.totp.domain.TribunalIntegracao;
import br.com.vilareal.totp.infrastructure.persistence.repository.CredencialTotpRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Provider TOTP para tribunais com {@link TipoSegundoFator#TOTP_APP}.
 */
@Component
public class TotpSegundoFatorCodigoProvider implements SegundoFatorCodigoProvider {

    private static final Logger log = LoggerFactory.getLogger(TotpSegundoFatorCodigoProvider.class);

    private final CredencialTotpRepository repository;
    private final TotpService totpService;

    public TotpSegundoFatorCodigoProvider(CredencialTotpRepository repository, TotpService totpService) {
        this.repository = repository;
        this.totpService = totpService;
    }

    @Override
    public boolean suporta(TribunalIntegracao tribunal) {
        return tribunal != null && tribunal.tipoSegundoFator() == TipoSegundoFator.TOTP_APP;
    }

    @Override
    public Optional<String> obterCodigo(TribunalIntegracao tribunal, String login) {
        if (!suporta(tribunal) || login == null || login.isBlank()) {
            return Optional.empty();
        }
        return repository.findByTribunalAndLoginAndAtivoTrue(tribunal, login.trim())
                .map(c -> {
                    try {
                        return totpService.gerarCodigoAtual(c.getId());
                    } catch (Exception e) {
                        log.warn("Falha ao gerar TOTP tribunal={} login={}: {}", tribunal, login, e.getMessage());
                        return null;
                    }
                })
                .filter(c -> c != null && !c.isBlank());
    }

    @Override
    public Optional<String> obterCodigoPorCredencialId(Long credencialTotpId) {
        if (credencialTotpId == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(totpService.gerarCodigoAtual(credencialTotpId));
        } catch (Exception e) {
            log.warn("Falha ao gerar TOTP credencialId={}: {}", credencialTotpId, e.getMessage());
            return Optional.empty();
        }
    }
}
