package br.com.vilareal.whatsapp.service;

/**
 * Regras gerais de elegibilidade para cobrança WhatsApp — independentes de cliente específico.
 *
 * <h2>Origem {@code PROCESSO} (cliente do escritório com unidade no processo)</h2>
 * <ul>
 *   <li>Pendência inferida do cálculo (rodada dimensão 0): débito sem {@code dataPagamento}
 *       ou parcela em aberto.</li>
 *   <li>Sem pendência → inelegível (quitado ou sem cálculo).</li>
 *   <li>{@code meta.dataCalculo} muito antiga → alerta (não entra na pré-seleção automática).</li>
 * </ul>
 *
 * <h2>Origem {@code IMOVEL} (condomínio / recebíveis)</h2>
 * <ul>
 *   <li>Pendência inferida de pagamentos {@code RECEBER} em aberto (EMITIDO/VENCIDO).</li>
 *   <li>Sem valor em aberto → não aparece no preview.</li>
 * </ul>
 *
 * <h2>Envio</h2>
 * <ul>
 *   <li>Disparo, agendamento e tick de agendados revalidam elegibilidade.</li>
 *   <li>{@code jaCobradoEsteMes} continua impedindo duplicata no mesmo mês.</li>
 * </ul>
 *
 * <p>Implementação: {@link CobrancaWhatsAppElegibilidadeService}, {@link CobrancaWhatsAppService}.
 */
public final class CobrancaWhatsAppRegras {

    private CobrancaWhatsAppRegras() {}
}
