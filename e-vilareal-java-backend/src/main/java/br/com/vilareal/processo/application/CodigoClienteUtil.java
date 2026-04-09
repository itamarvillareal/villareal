package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;

public final class CodigoClienteUtil {

    private CodigoClienteUtil() {}

    public static String formatar(Long id) {
        if (id == null) {
            return "";
        }
        return String.format("%08d", id);
    }

    public static long parsePessoaId(String codigoCliente) {
        if (codigoCliente == null || codigoCliente.isBlank()) {
            throw new BusinessRuleException("codigoCliente é obrigatório");
        }
        String stripped = codigoCliente.trim().replaceFirst("^0+", "");
        if (stripped.isEmpty()) {
            stripped = "0";
        }
        try {
            return Long.parseLong(stripped);
        } catch (NumberFormatException e) {
            throw new BusinessRuleException("codigoCliente inválido");
        }
    }

    /**
     * Código de cliente com 8 dígitos quando o valor é só dígitos (ex.: {@code "1"}, {@code "0001"} → {@code "00000001"}).
     * Caso contrário retorna o texto trimado sem alteração.
     */
    public static String normalizarCodigoClienteOitoDigitos(String codigoOuChave) {
        if (codigoOuChave == null) {
            return null;
        }
        String t = codigoOuChave.trim();
        if (t.isEmpty()) {
            return "";
        }
        if (!t.chars().allMatch(Character::isDigit)) {
            return t;
        }
        try {
            return formatar(parsePessoaId(t));
        } catch (BusinessRuleException e) {
            return t;
        }
    }
}
