package br.com.vilareal.imovel.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Sugestões de aluguel para contratos vigentes ainda sem crédito vinculado na competência.
 * Cruza créditos do extrato (órfãos, sem Cod.+Proc.) com o nome do inquilino e o valor do
 * contrato — o usuário confirma caso a caso (nada é gravado por este endpoint).
 */
public record SugestoesAluguelPendenteResponse(
        String competencia,
        int totalContratosPendentes,
        int totalComSugestao,
        List<ContratoPendenteItem> contratos) {

    public record ContratoPendenteItem(
            Long contratoId,
            Integer imovelNumeroPlanilha,
            String imovelEndereco,
            String inquilinoNome,
            BigDecimal valorAluguel,
            Integer diaVencimentoAluguel,
            List<SugestaoCreditoItem> sugestoes) {}

    /**
     * @param origemCandidato ORFAO (sem Cod.+Proc.; será adotado ao vincular) ou PROCESSO
     *     (crédito Cora já classificado no processo do imóvel, faltando só o vínculo ALUGUEL)
     */
    public record SugestaoCreditoItem(
            Long lancamentoFinanceiroId,
            LocalDate dataLancamento,
            String descricao,
            BigDecimal valor,
            Integer numeroBanco,
            String origemCandidato,
            String confianca,
            boolean nomeConfere,
            boolean valorConfere,
            boolean diaConfere) {}
}
