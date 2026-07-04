package br.com.vilareal.condominio.application;

/**
 * Regras de negócio compartilhadas para importação de cobrança condominial — válidas para
 * <strong>todos os clientes</strong>, nos fluxos onde couber (cobrança automática, inadimplência
 * em lote, etc.).
 *
 * <p>Implementação: {@link CobrancaUnidadeResolverService}, {@link CalculoCobrancaMergeService}
 * (módulo cálculo), {@link CobrancaUnidadeFormatUtil}, {@link ProcessoUnidadeClienteLookupService}.
 *
 * <h2>Processo e unidade</h2>
 * <ul>
 *   <li>Busca processo por {@code cliente_id + unidade}, com variantes normalizadas
 *       ({@code A-0203}, {@code QD12-LT03} / {@code QD12LT03}, rótulo legível).</li>
 *   <li>Novo processo usa o menor {@code numero_interno} livre do cliente (sequência compacta).</li>
 *   <li>Mesmo réu + mesma unidade → reutilizar processo e mesclar débitos.</li>
 *   <li>Réu diferente na mesma unidade → novo processo ({@code revisaoTrocaDono}), mantendo o legado.</li>
 * </ul>
 *
 * <h2>Merge de débitos (cálculo)</h2>
 * <ul>
 *   <li>Mesclar apenas na primeira dimensão com {@code parcelamento_aceito = 0} (cascata).</li>
 *   <li>Ignorar título duplicado (mesmo vencimento + mesmo valor).</li>
 *   <li>Mesmo vencimento com <strong>valor diferente</strong> → bloquear importação
 *       ({@link br.com.vilareal.common.exception.BusinessRuleException} revisão manual).</li>
 * </ul>
 *
 * <h2>Proprietário (planilha / PDF)</h2>
 * <ul>
 *   <li>Origem do relatório definida por {@code calculo_cliente_config.entradaCobranca}:
 *       {@code XLS_INADIMPLENCIA} (planilha .xls) ou {@code PDF_CONDO_ID} (PDF Condo Id).</li>
 *   <li>PDF Condo Id: débitos only; proprietário vem da planilha Condôminos ou do cadastro existente.</li>
 *   <li>Planilha .xls legada: proprietário inline no relatório de inadimplência.</li>
 *   <li>Processo com {@code parcelamento_aceito = 1} não deve ser excluído automaticamente
 *       (scripts de limpeza devem pular).</li>
 *   <li>Ex-proprietário ausente da planilha atual → não receber nova cobrança no processo legado
 *       (revisão manual / troca de dono).</li>
 * </ul>
 *
 * <h2>Pós-exclusão de duplicatas (manutenção)</h2>
 * <ul>
 *   <li>Lacunas em {@code numero_interno} podem ser preenchidas compactando os últimos processos
 *       ativos (scripts {@code compactar-lacunas-proc-cliente.mjs}).</li>
 * </ul>
 */
public final class CobrancaImportRegras {

    private CobrancaImportRegras() {}
}
