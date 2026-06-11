package br.com.vilareal.totp.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.totp.domain.TribunalIntegracao;
import br.com.vilareal.totp.infrastructure.persistence.entity.CredencialTotpEntity;
import br.com.vilareal.totp.infrastructure.persistence.repository.CredencialTotpRepository;
import br.com.vilareal.totp.security.SegredoCipherService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Optional;

@Service
public class CredencialTotpService {

    private final CredencialTotpRepository repository;
    private final SegredoCipherService cipherService;

    public CredencialTotpService(CredencialTotpRepository repository, SegredoCipherService cipherService) {
        this.repository = repository;
        this.cipherService = cipherService;
    }

    @Transactional
    public CredencialTotpEntity cadastrarOuAtualizar(
            TribunalIntegracao tribunal,
            String login,
            String otpauthUriOuSecret,
            String senhaPrimeiroFator,
            Boolean ativo) {
        if (!cipherService.chaveConfigurada()) {
            throw new BusinessRuleException(
                    "Cofre TOTP indisponível: configure app.totp.encryption-key (32 bytes Base64).");
        }
        String loginNorm = normalizarLogin(login);
        OtpauthParser.OtpauthDados dados = OtpauthParser.parse(otpauthUriOuSecret);

        CredencialTotpEntity entity = repository.findByTribunalAndLogin(tribunal, loginNorm)
                .orElseGet(CredencialTotpEntity::new);
        entity.setTribunal(tribunal);
        entity.setLogin(loginNorm);
        entity.setSecretCriptografado(cipherService.cifrar(dados.secretBase32()));
        entity.setAlgoritmo(dados.algoritmo());
        entity.setDigitos(dados.digitos());
        entity.setPeriodoSegundos(dados.periodoSegundos());
        entity.setIssuer(dados.issuer());
        entity.setAccountName(dados.accountName());
        aplicarSenhaOpcional(entity, senhaPrimeiroFator);
        if (ativo != null) {
            entity.setAtivo(ativo);
        } else if (entity.getId() == null) {
            entity.setAtivo(true);
        }
        return repository.save(entity);
    }

    @Transactional
    public CredencialTotpEntity atualizarPorId(
            Long id, String otpauthUriOuSecret, String senhaPrimeiroFator, Boolean ativo) {
        if (!cipherService.chaveConfigurada()) {
            throw new BusinessRuleException(
                    "Cofre TOTP indisponível: configure app.totp.encryption-key (32 bytes Base64).");
        }
        CredencialTotpEntity entity = buscar(id);
        OtpauthParser.OtpauthDados dados = OtpauthParser.parse(otpauthUriOuSecret);
        entity.setSecretCriptografado(cipherService.cifrar(dados.secretBase32()));
        entity.setAlgoritmo(dados.algoritmo());
        entity.setDigitos(dados.digitos());
        entity.setPeriodoSegundos(dados.periodoSegundos());
        entity.setIssuer(dados.issuer());
        entity.setAccountName(dados.accountName());
        aplicarSenhaOpcional(entity, senhaPrimeiroFator);
        if (ativo != null) {
            entity.setAtivo(ativo);
        }
        return repository.save(entity);
    }

    /**
     * Decifra a senha do 1º fator só para uso imediato no robô — nunca logar o retorno.
     */
    @Transactional(readOnly = true)
    public Optional<String> obterSenhaPrimeiroFator(TribunalIntegracao tribunal, String login) {
        if (!cipherService.chaveConfigurada()) {
            return Optional.empty();
        }
        return repository.findByTribunalAndLoginAndAtivoTrue(tribunal, normalizarLogin(login))
                .filter(e -> StringUtils.hasText(e.getSenhaCriptografada()))
                .map(e -> cipherService.decifrar(e.getSenhaCriptografada()));
    }

    /**
     * Define ou substitui somente a senha do 1º fator — não altera segredo TOTP nem demais metadados.
     */
    @Transactional
    public CredencialTotpEntity definirSenhaPrimeiroFator(Long id, String senha) {
        if (!cipherService.chaveConfigurada()) {
            throw new BusinessRuleException(
                    "Cofre TOTP indisponível: configure app.totp.encryption-key (32 bytes Base64).");
        }
        if (!StringUtils.hasText(senha)) {
            throw new BusinessRuleException("Senha do 1º fator é obrigatória.");
        }
        CredencialTotpEntity entity = buscar(id);
        entity.setSenhaCriptografada(cipherService.cifrar(senha.trim()));
        return repository.save(entity);
    }

    @Transactional(readOnly = true)
    public CredencialTotpEntity buscar(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Credencial TOTP não encontrada: " + id));
    }

    @Transactional(readOnly = true)
    public CredencialTotpEntity buscarAtivaPorTribunalLogin(TribunalIntegracao tribunal, String login) {
        return repository.findByTribunalAndLoginAndAtivoTrue(tribunal, normalizarLogin(login))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Credencial TOTP não encontrada para " + tribunal + " / " + login));
    }

    private void aplicarSenhaOpcional(CredencialTotpEntity entity, String senhaPrimeiroFator) {
        if (StringUtils.hasText(senhaPrimeiroFator)) {
            entity.setSenhaCriptografada(cipherService.cifrar(senhaPrimeiroFator.trim()));
        }
    }

    private static String normalizarLogin(String login) {
        if (login == null || login.isBlank()) {
            throw new IllegalArgumentException("Login é obrigatório.");
        }
        return login.trim();
    }
}
