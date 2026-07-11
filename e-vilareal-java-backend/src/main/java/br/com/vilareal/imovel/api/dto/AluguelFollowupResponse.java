package br.com.vilareal.imovel.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Casos em aberto de aluguel em atraso com gestão de follow-up: para cada caso a API diz qual é a
 * PRÓXIMA AÇÃO (enviar mensagem, reenviar, ligar, verificar resposta) e o prazo — para que nenhum
 * caso dependa da memória do usuário. Um caso é contrato × competência vencida sem aluguel vinculado;
 * ele sai da lista sozinho quando o pagamento é conciliado.
 */
public record AluguelFollowupResponse(
        String competenciaBase,
        int mesesAnalisados,
        int totalCasos,
        int totalAcaoHoje,
        int totalAguardando,
        List<Item> itens) {

    /**
     * @param proximaAcao ENVIAR_MENSAGEM, REENVIAR_MENSAGEM, LIGAR, VERIFICAR_RESPOSTA ou AGUARDAR
     * @param acaoVencida true quando o prazo da ação é hoje ou já passou (caso exige atenção agora)
     */
    public record Item(
            Long contratoId,
            String competencia,
            Integer imovelNumeroPlanilha,
            Long imovelId,
            String imovelEndereco,
            String condominio,
            String unidade,
            String inquilinoNome,
            Long inquilinoPessoaId,
            BigDecimal valorAluguel,
            LocalDate dataVencimento,
            int diasAtraso,
            int cobrancasEnviadas,
            Instant ultimaCobrancaEm,
            boolean respondeuAposUltimaAcao,
            Instant ultimaRespostaEm,
            int ligacoesRegistradas,
            Instant ultimaLigacaoEm,
            String ultimaAnotacao,
            LocalDate adiadoAte,
            String proximaAcao,
            String proximaAcaoDescricao,
            LocalDate prazoAcao,
            boolean acaoVencida,
            int diasSemAcao,
            boolean temTelefone,
            String telefoneFormatado,
            String telefoneE164) {}

    /** Registro manual de evento do caso (ligação feita, anotação, adiar ou resolver manualmente). */
    public record EventoRequest(
            Long contratoId, String competencia, String tipo, String observacao, LocalDate adiadoAte) {}
}
