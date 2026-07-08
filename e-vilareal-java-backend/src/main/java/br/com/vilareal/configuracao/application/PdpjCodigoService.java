package br.com.vilareal.configuracao.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.configuracao.api.dto.PdpjCodigoResponse;
import br.com.vilareal.totp.application.TotpService;
import br.com.vilareal.totp.domain.TribunalIntegracao;
import br.com.vilareal.totp.infrastructure.persistence.entity.CredencialTotpEntity;
import br.com.vilareal.totp.infrastructure.persistence.repository.CredencialTotpRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;

@Service
public class PdpjCodigoService {

    private final CredencialTotpRepository credencialTotpRepository;
    private final TotpService totpService;

    public PdpjCodigoService(CredencialTotpRepository credencialTotpRepository, TotpService totpService) {
        this.credencialTotpRepository = credencialTotpRepository;
        this.totpService = totpService;
    }

    @Transactional(readOnly = true)
    public PdpjCodigoResponse obterCodigoAtual() {
        List<CredencialTotpEntity> credenciais =
                credencialTotpRepository.findAllByTribunalAndAtivoTrue(TribunalIntegracao.PJE_TRT18);
        if (credenciais.isEmpty()) {
            throw new ResourceNotFoundException(
                    "Credencial TOTP PDPJ (PJe TRT18) não configurada ou inativa.");
        }
        if (credenciais.size() > 1) {
            credenciais = credenciais.stream()
                    .sorted(Comparator.comparing(CredencialTotpEntity::getId))
                    .toList();
        }
        CredencialTotpEntity cred = credenciais.get(0);
        String codigo = totpService.gerarCodigoAtualSemMargem(cred.getId());
        long agora = System.currentTimeMillis() / 1000L;
        int periodo = cred.getPeriodoSegundos();
        long segundosNoPeriodo = Math.floorMod(agora, periodo);
        int restantes = (int) (periodo - segundosNoPeriodo);
        if (!StringUtils.hasText(codigo)) {
            throw new BusinessRuleException("Não foi possível gerar o código PDPJ.");
        }
        return new PdpjCodigoResponse(
                codigo.trim(),
                cred.getDigitos(),
                periodo,
                restantes,
                mascararLogin(cred.getLogin()));
    }

    static String mascararLogin(String login) {
        if (!StringUtils.hasText(login)) {
            return "—";
        }
        String s = login.trim();
        if (s.length() <= 4) {
            return "****";
        }
        return s.substring(0, 2) + "****" + s.substring(s.length() - 2);
    }
}
