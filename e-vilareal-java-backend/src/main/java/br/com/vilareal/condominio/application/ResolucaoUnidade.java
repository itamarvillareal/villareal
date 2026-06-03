package br.com.vilareal.condominio.application;

/**
 * Resultado da resolução de devedor (pessoa) e processo da unidade.
 */
public record ResolucaoUnidade(
        long pessoaIdDevedor,
        boolean pessoaCriada,
        String generoDefinido,
        long processoId,
        int numeroInterno,
        boolean processoCriado,
        boolean reuVinculado,
        boolean revisaoTrocaDono,
        Long pessoaIdReuAnterior) {}
