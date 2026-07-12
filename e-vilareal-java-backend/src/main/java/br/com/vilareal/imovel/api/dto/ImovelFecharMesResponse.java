package br.com.vilareal.imovel.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** Checklist agregado do ciclo mensal («Fechar o Mês») — Etapa 6. */
@Getter
@Setter
public class ImovelFecharMesResponse {
    private String competencia;
    private Checklist checklist = new Checklist();
    private RepassePendenteCarteiraResponse repassesPendentes;

    @Getter
    @Setter
    public static class Checklist {
        private int alugueisRecebidos;
        private int alugueisTotal;
        private int cobrancasAFazer;
        private int repassesHoje;
        private BigDecimal repassesHojeValor = BigDecimal.ZERO;
        private int despesasAClassificar;
        private int sugestoesVinculo;
        /** true quando todos os indicadores do ciclo estão zerados/concluídos. */
        private boolean mesFechado;
    }
}
