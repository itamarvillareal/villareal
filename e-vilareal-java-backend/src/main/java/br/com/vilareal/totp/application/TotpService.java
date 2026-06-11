package br.com.vilareal.totp.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.totp.domain.TotpAlgoritmo;
import br.com.vilareal.totp.infrastructure.persistence.entity.CredencialTotpEntity;
import br.com.vilareal.totp.infrastructure.persistence.repository.CredencialTotpRepository;
import br.com.vilareal.totp.security.SegredoCipherService;
import dev.samstevens.totp.code.CodeGenerator;
import dev.samstevens.totp.code.DefaultCodeGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Geração de códigos TOTP (RFC 6238) a partir de segredos cifrados.
 */
@Service
public class TotpService {

    private static final Logger log = LoggerFactory.getLogger(TotpService.class);

    private final CredencialTotpRepository repository;
    private final SegredoCipherService cipherService;
    private final int margemBordaSegundos;

    public TotpService(
            CredencialTotpRepository repository,
            SegredoCipherService cipherService,
            @Value("${app.totp.border-margin-seconds:3}") int margemBordaSegundos) {
        this.repository = repository;
        this.cipherService = cipherService;
        this.margemBordaSegundos = Math.max(0, margemBordaSegundos);
    }

    public String gerarCodigo(
            String secretBase32,
            TotpAlgoritmo algoritmo,
            int digitos,
            int periodoSegundos,
            long instanteEpochSegundos) {
        validarParametros(secretBase32, digitos, periodoSegundos);
        long counter = Math.floorDiv(instanteEpochSegundos, periodoSegundos);
        CodeGenerator generator = new DefaultCodeGenerator(algoritmo.hashingAlgorithm(), digitos);
        try {
            return generator.generate(secretBase32, counter);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao gerar código TOTP.", e);
        }
    }

    /**
     * Gera o código vigente sem aguardar margem de borda (uso admin/teste).
     */
    public String gerarCodigoAtualSemMargem(Long credencialId) {
        CredencialTotpEntity cred = repository.findByIdAndAtivoTrue(credencialId)
                .orElseThrow(() -> new ResourceNotFoundException("Credencial TOTP não encontrada: " + credencialId));
        String secret = cipherService.decifrar(cred.getSecretCriptografado());
        long agora = System.currentTimeMillis() / 1000L;
        return gerarCodigo(
                secret,
                cred.getAlgoritmo(),
                cred.getDigitos(),
                cred.getPeriodoSegundos(),
                agora);
    }

    /**
     * Gera o código vigente para a credencial, com proteção de borda no fim do período.
     */
    public String gerarCodigoAtual(Long credencialId) {
        CredencialTotpEntity cred = repository.findByIdAndAtivoTrue(credencialId)
                .orElseThrow(() -> new ResourceNotFoundException("Credencial TOTP não encontrada: " + credencialId));
        String secret = cipherService.decifrar(cred.getSecretCriptografado());
        long agora = System.currentTimeMillis() / 1000L;
        long instante = resolverInstanteComMargem(agora, cred.getPeriodoSegundos());
        String codigo = gerarCodigo(
                secret,
                cred.getAlgoritmo(),
                cred.getDigitos(),
                cred.getPeriodoSegundos(),
                instante);
        if (log.isDebugEnabled()) {
            log.debug(
                    "TOTP gerado credencialId={} tribunal={} login={} codigo=******",
                    cred.getId(),
                    cred.getTribunal(),
                    cred.getLogin());
        }
        return codigo;
    }

    /**
     * Se faltam menos de {@code margemBordaSegundos} para o fim do período, aguarda o próximo ciclo.
     */
    long resolverInstanteComMargem(long instanteEpochSegundos, int periodoSegundos) {
        if (margemBordaSegundos <= 0 || periodoSegundos <= 0) {
            return instanteEpochSegundos;
        }
        long segundosNoPeriodo = Math.floorMod(instanteEpochSegundos, periodoSegundos);
        long segundosRestantes = periodoSegundos - segundosNoPeriodo;
        if (segundosRestantes > margemBordaSegundos) {
            return instanteEpochSegundos;
        }
        long espera = segundosRestantes;
        if (espera > 0) {
            try {
                Thread.sleep(espera * 1000L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrompido ao aguardar próximo período TOTP.", e);
            }
        }
        return (instanteEpochSegundos + espera);
    }

    private static void validarParametros(String secretBase32, int digitos, int periodoSegundos) {
        if (OtpauthParser.normalizarSecret(secretBase32) == null) {
            throw new IllegalArgumentException("Secret Base32 inválido.");
        }
        if (digitos < 6 || digitos > 10) {
            throw new IllegalArgumentException("Dígitos TOTP devem estar entre 6 e 10.");
        }
        if (periodoSegundos < 15 || periodoSegundos > 120) {
            throw new IllegalArgumentException("Período TOTP deve estar entre 15 e 120 segundos.");
        }
    }
}
