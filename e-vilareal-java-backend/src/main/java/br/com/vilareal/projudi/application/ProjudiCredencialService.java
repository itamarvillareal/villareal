package br.com.vilareal.projudi.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.projudi.api.dto.ProjudiCredencialResponse;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiCredencialEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiCredencialRepository;
import br.com.vilareal.projudi.security.CredencialCryptoService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cofre de credenciais PROJUDI: orquestra cifragem/decifragem e persistência.
 *
 * <p>O plaintext da senha entra apenas em {@link #salvar} e sai apenas em
 * {@link #obterSenha} (uso interno). Nenhum método expõe a senha em DTO nem a
 * registra em log.</p>
 */
@Service
public class ProjudiCredencialService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiCredencialService.class);

    private final ProjudiCredencialRepository repository;
    private final CredencialCryptoService crypto;

    public ProjudiCredencialService(ProjudiCredencialRepository repository,
                                    CredencialCryptoService crypto) {
        this.repository = repository;
        this.crypto = crypto;
    }

    /**
     * Garante, na partida, que se já existe credencial cadastrada a chave de
     * cifragem está configurada — sem ela seria impossível decifrar.
     */
    @EventListener(ApplicationReadyEvent.class)
    void validarChaveNaInicializacao() {
        if (!crypto.chaveConfigurada() && repository.count() > 0) {
            throw new IllegalStateException(
                    "Há credenciais PROJUDI cadastradas, mas PROJUDI_CRED_KEY não está configurada: "
                            + "as senhas não poderiam ser decifradas.");
        }
    }

    /**
     * Cifra a senha e persiste (cria ou atualiza por CPF). A senha em claro não
     * é logada nem retornada.
     */
    @Transactional
    public ProjudiCredencialResponse salvar(String cpf, String senhaEmClaro, String rotulo) {
        String cpfNorm = exigirTexto(cpf, "CPF");
        if (senhaEmClaro == null || senhaEmClaro.isEmpty()) {
            throw new BusinessRuleException("A senha é obrigatória.");
        }
        CredencialCryptoService.Resultado cifra = crypto.cifrar(senhaEmClaro);

        ProjudiCredencialEntity e = repository.findByCpfUsuario(cpfNorm)
                .orElseGet(ProjudiCredencialEntity::new);
        e.setCpfUsuario(cpfNorm);
        e.setSenhaCifrada(cifra.cifrado());
        e.setIv(cifra.iv());
        e.setRotulo(trimToNull(rotulo));
        e.setAtivo(true);
        e = repository.save(e);
        log.info("Credencial PROJUDI salva (id={}, cpf=***).", e.getId());
        return ProjudiCredencialResponse.de(e);
    }

    /**
     * Decifra e devolve a senha em claro. <b>Uso interno</b> (login automatizado);
     * jamais expor o retorno em resposta de API ou log.
     */
    @Transactional(readOnly = true)
    public String obterSenha(Long credencialId) {
        ProjudiCredencialEntity e = buscar(credencialId);
        return crypto.decifrar(e.getSenhaCifrada(), e.getIv());
    }

    @Transactional(readOnly = true)
    public ProjudiCredencialResponse obter(Long credencialId) {
        return ProjudiCredencialResponse.de(buscar(credencialId));
    }

    /** Remove a credencial do cofre. */
    @Transactional
    public void excluir(Long credencialId) {
        ProjudiCredencialEntity e = buscar(credencialId);
        repository.deleteById(e.getId());
        log.info("Credencial PROJUDI excluída (id={}).", e.getId());
    }

    private ProjudiCredencialEntity buscar(Long id) {
        if (id == null || id < 1) {
            throw new BusinessRuleException("Identificador inválido.");
        }
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Credencial PROJUDI não encontrada: " + id));
    }

    private static String exigirTexto(String valor, String campo) {
        String t = trimToNull(valor);
        if (t == null) {
            throw new BusinessRuleException(campo + " é obrigatório.");
        }
        return t;
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
