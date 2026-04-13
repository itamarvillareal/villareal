package br.com.vilareal.calculo.model;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.processo.application.CodigoClienteUtil;

/**
 * Chave {@code codigoCliente8:numeroProcesso:dimensao}, igual à convenção da tela {@code Calculos.jsx} / {@code calculosRodadasStorage.js}.
 */
public record RodadaCalculoChave(String codigoCliente, int numeroProcesso, int dimensao) {

    /**
     * Normaliza {@code codigoCliente} para 8 dígitos e valida proc/dim (mesmas regras de {@link #parse(String)}).
     */
    public static RodadaCalculoChave fromPath(String codigoCliente, int numeroProcesso, int dimensao) {
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente);
        if (cod8 == null || cod8.isBlank()) {
            throw new BusinessRuleException("codigoCliente é obrigatório");
        }
        if (cod8.length() != 8 || !cod8.chars().allMatch(Character::isDigit)) {
            throw new BusinessRuleException("codigoCliente na chave deve ter 8 dígitos");
        }
        return parse(cod8 + ":" + numeroProcesso + ":" + dimensao);
    }

    public static RodadaCalculoChave parse(String key) {
        if (key == null || key.isBlank()) {
            throw new BusinessRuleException("Chave de rodada inválida");
        }
        String[] p = key.split(":");
        if (p.length != 3) {
            throw new BusinessRuleException("Chave de rodada inválida: use codigoCliente(8 dígitos):proc:dimensão");
        }
        String cod = p[0].trim();
        if (cod.length() != 8 || !cod.chars().allMatch(Character::isDigit)) {
            throw new BusinessRuleException("codigoCliente na chave deve ter 8 dígitos");
        }
        int proc;
        int dim;
        try {
            proc = Integer.parseInt(p[1].trim());
            dim = Integer.parseInt(p[2].trim());
        } catch (NumberFormatException e) {
            throw new BusinessRuleException("proc e dimensão devem ser numéricos");
        }
        if (proc < 1) {
            throw new BusinessRuleException("proc deve ser >= 1");
        }
        if (dim < 0) {
            throw new BusinessRuleException("dimensão deve ser >= 0");
        }
        return new RodadaCalculoChave(cod, proc, dim);
    }

    public String toMapKey() {
        return codigoCliente + ":" + numeroProcesso + ":" + dimensao;
    }
}
