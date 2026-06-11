package br.com.vilareal.totp.application;

import br.com.vilareal.totp.domain.TribunalIntegracao;

import java.util.Optional;

/**
 * Ponto de extensão para o robô de login obter códigos de segundo fator.
 * Implementações concretas (TOTP, e-mail) permanecem desacopladas do orquestrador PROJUDI.
 */
public interface SegundoFatorCodigoProvider {

    /** Indica se este provider atende o tribunal informado. */
    boolean suporta(TribunalIntegracao tribunal);

    /**
     * Obtém o código de 2FA para tribunal + login (ex.: CPF do advogado).
     * Vazio quando o provider não se aplica ou não há credencial cadastrada.
     */
    Optional<String> obterCodigo(TribunalIntegracao tribunal, String login);

    /**
     * Obtém o código TOTP pela PK da credencial ({@code credencial_totp.id}).
     */
    Optional<String> obterCodigoPorCredencialId(Long credencialTotpId);
}
