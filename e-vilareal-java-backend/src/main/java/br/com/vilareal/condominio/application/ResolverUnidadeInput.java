package br.com.vilareal.condominio.application;

/**
 * Entrada do resolvedor de devedor + processo por unidade (cobrança automática).
 */
public record ResolverUnidadeInput(
        long clienteId,
        long clientePessoaId,
        String codigoCliente8,
        String unidadeNormalizada,
        String devedorNome,
        String devedorDocDigitos,
        String importacaoId) {}
