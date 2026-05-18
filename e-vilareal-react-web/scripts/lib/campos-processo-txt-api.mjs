/**
 * Catálogo: nomes TXT legados (VB) → colunas `processo` na API MySQL.
 */

/**
 * Ficheiros semânticos `.Processo{N}.Processos` (Gerais/Proc) — relação directa 1:1 com coluna API.
 * Estes são os campos que o utilizador pediu para zerar antes da importação txt.
 */
export const COLUNAS_PROCESSO_TXT_SEMANTICO = [
  'papel_cliente', // ClienteRequerenteOuRequerido
  'audiencia_data', // DatadaAudiencia
  'audiencia_hora', // HoraAudiencia
  'audiencia_tipo', // TipodeAudiencia
  'aviso_audiencia', // ClienteAvisado
];

/**
 * Outros tipos numéricos / pastas (fase, CNJ, etc.) — importação txt separada;
 * NÃO zerar por defeito (podem coexistir com planilha).
 */
export const COLUNAS_PROCESSO_TXT_CABECALHO = [
  'numero_cnj',
  'numero_processo_antigo',
  'data_protocolo',
  'natureza_acao',
  'descricao_acao',
  'valor_causa',
  'uf',
  'cidade',
  'competencia',
  'fase',
  'observacao_fase',
  'tramitacao',
  'prazo_fatal',
  'proxima_consulta',
  'observacao',
  'unidade',
  'pasta',
  'consultor',
  'usuario_responsavel_id',
];

/** @deprecated Use COLUNAS_PROCESSO_TXT_SEMANTICO ou união explícita. */
export const COLUNAS_PROCESSO_TXT = [
  ...COLUNAS_PROCESSO_TXT_CABECALHO,
  ...COLUNAS_PROCESSO_TXT_SEMANTICO,
];

export const FASE_PADRAO_SQL = 'Em Andamento';

export const ORIGENS_ANDAMENTO_TXT = ['IMPORT_TXT_LOCAL'];

/**
 * @param {string[]} colunas
 */
export function sqlZerarColunasProcesso(colunas) {
  const sets = colunas.map((c) => {
    if (c === 'fase') return `fase = '${FASE_PADRAO_SQL}'`;
    return `${c} = NULL`;
  });
  return `UPDATE processo SET ${sets.join(', ')}`;
}
