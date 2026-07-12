package br.com.vilareal.imovel.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Triagem automática dos aluguéis da competência: o que a API resolve sozinha vai para
 * conciliação 1-clique; o que precisa de ação humana (atraso) já vem com a ferramenta
 * de cobrança WhatsApp ao lado.
 */
public record AluguelTriagemResponse(
        String competencia,
        int totalPendentes,
        int totalPagamentoProvavel,
        int totalEmAtraso,
        int totalAVencer,
        List<Item> itens) {

    /**
     * @param situacao PAGAMENTO_PROVAVEL (crédito no extrato aguardando conciliação),
     *     EM_ATRASO (vencido e sem crédito localizado) ou A_VENCER (ainda no prazo)
     */
    public record Item(
            Long contratoId,
            Integer imovelNumeroPlanilha,
            Long imovelId,
            String imovelEndereco,
            String condominio,
            String unidade,
            String inquilinoNome,
            Long inquilinoPessoaId,
            BigDecimal valorAluguel,
            Integer diaVencimentoAluguel,
            LocalDate dataVencimento,
            int diasAtraso,
            String situacao,
            String confiancaPagamento,
            int qtdSugestoesExtrato,
            boolean temTelefone,
            String telefoneFormatado,
            boolean jaCobradoEsteMes,
            /** Opt-in: agendar cobrança WhatsApp no dia de vencimento (contrato). */
            boolean agendarCobrancaWhatsApp) {}

    public record CobrarRequest(List<Long> contratoIds, String competencia, Boolean agendarCobrancaWhatsApp) {}
}
