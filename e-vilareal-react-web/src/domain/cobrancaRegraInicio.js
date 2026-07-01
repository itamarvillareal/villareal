/** Valores permitidos para regraInicioCobrancaDias (alinhado ao backend). */
const REGRAS_PERMITIDAS = [1, 61];

/** Limite da regra condicional: > 60 dias (= 61+ na planilha). */
export const REGRA_CONDICIONAL_LIMITE_DIAS = 60;
export const REGRA_CONDICIONAL_MINIMO_PLANILHA = 61;

/**
 * @param {unknown} valor
 * @returns {1 | 61}
 */
export function normalizarRegraInicioCobrancaDias(valor) {
  const n = Number(valor);
  if (n === 30 || n === 60) return 61;
  if (REGRAS_PERMITIDAS.includes(n)) return /** @type {1 | 61} */ (n);
  return 1;
}

/** @param {1 | 61 | number} regraDias */
export function labelRegraInicio(regraDias) {
  const r = normalizarRegraInicioCobrancaDias(regraDias);
  if (r === 61) return '60+1 condicional';
  return 'Importar tudo';
}

/** Texto curto para «Importar tudo». */
export const DESCRICAO_REGRA_IMPORTAR_TUDO =
  'Importa toda unidade da planilha que tenha pelo menos uma taxa vencida (1 dia ou mais de atraso).';

/**
 * Explicação da regra 60+1 condicional (importação .xls).
 * Alinhada a CobrancaRegraInicioCobrancaService no backend.
 * @type {string[]}
 */
export const LINHAS_DESCRICAO_REGRA_CONDICIONAL_60_MAIS_1 = [
  'Regra em duas situações:',
  'Se a unidade já tem débito cadastrado em Cálculos (parcelamento não aceito) com mais de 60 dias de atraso → importa todas as taxas em aberto da planilha dessa unidade.',
  'Caso contrário → a unidade só entra se a planilha tiver alguma taxa com 61 dias ou mais de atraso (vencimento há mais de 60 dias).',
];

export const DESCRICAO_REGRA_CONDICIONAL_60_MAIS_1 = LINHAS_DESCRICAO_REGRA_CONDICIONAL_60_MAIS_1.join(' ');

/** @param {1 | 61 | number} regraDias @returns {string | string[]} */
export function descricaoRegraInicio(regraDias) {
  const r = normalizarRegraInicioCobrancaDias(regraDias);
  if (r === 61) return LINHAS_DESCRICAO_REGRA_CONDICIONAL_60_MAIS_1;
  return DESCRICAO_REGRA_IMPORTAR_TUDO;
}

/**
 * @param {string | null | undefined} texto dd/MM/yyyy
 * @returns {Date | null} meia-noite no fuso local
 */
export function parseVencimentoDdMmYyyy(texto) {
  const s = String(texto ?? '').trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  const year = Number(m[3]);
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
  return d;
}

/** @param {Date} d */
function inicioDiaLocal(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Dias entre vencimento e data de referência (hoje no processamento).
 * Vencimento futuro ou inválido → null (não aciona).
 * @param {string | null | undefined} vencimento
 * @param {Date} [dataReferencia]
 * @returns {number | null}
 */
export function diasDesdeVencimento(vencimento, dataReferencia = new Date()) {
  const venc = parseVencimentoDdMmYyyy(vencimento);
  if (!venc) return null;
  const ref = inicioDiaLocal(dataReferencia);
  const vencDia = inicioDiaLocal(venc);
  const diff = Math.floor((ref.getTime() - vencDia.getTime()) / 86_400_000);
  if (diff <= 0) return null;
  return diff;
}

/**
 * @param {{ cobrancas?: Array<{ vencimento?: string | null }> } | null | undefined} unidade
 * @param {Date} [dataReferencia]
 * @returns {number | null}
 */
export function maiorDiasAtrasoUnidade(unidade, dataReferencia = new Date()) {
  const list = unidade?.cobrancas;
  if (!Array.isArray(list)) return null;
  let max = null;
  for (const c of list) {
    const d = diasDesdeVencimento(c?.vencimento, dataReferencia);
    if (d != null && (max == null || d > max)) max = d;
  }
  return max;
}

/**
 * Prévia client-side (não consulta débitos cadastrados — regra 61 pode incluir mais unidades no backend).
 * @param {{ cobrancas?: Array<{ vencimento?: string | null }> } | null | undefined} unidade
 * @param {number} regraDias
 * @param {Date} [dataReferencia]
 */
export function unidadeAcionadaPelaRegra(unidade, regraDias, dataReferencia = new Date()) {
  const r = normalizarRegraInicioCobrancaDias(regraDias);
  const list = unidade?.cobrancas;
  if (!Array.isArray(list)) return false;
  if (r === 1) {
    for (const c of list) {
      const d = diasDesdeVencimento(c?.vencimento, dataReferencia);
      if (d != null && d >= 1) return true;
    }
    return false;
  }
  for (const c of list) {
    const d = diasDesdeVencimento(c?.vencimento, dataReferencia);
    if (d != null && d >= REGRA_CONDICIONAL_MINIMO_PLANILHA) return true;
  }
  return false;
}

/**
 * @param {Array<{ cobrancas?: Array<{ vencimento?: string | null }> }>} unidades
 * @param {number} regraDias
 * @param {Date} [dataReferencia]
 */
export function resumoPreviasRegraInicio(unidades, regraDias, dataReferencia = new Date()) {
  const t = normalizarRegraInicioCobrancaDias(regraDias);
  let acionados = 0;
  let descartados = 0;
  let titulosDescartados = 0;
  for (const u of unidades || []) {
    if (unidadeAcionadaPelaRegra(u, t, dataReferencia)) {
      acionados += 1;
    } else {
      descartados += 1;
      const list = u?.cobrancas;
      if (Array.isArray(list)) {
        for (const c of list) {
          if (c?.vencimento != null && String(c.vencimento).trim() !== '') titulosDescartados += 1;
        }
      }
    }
  }
  return { regraLabel: labelRegraInicio(t), acionados, descartados, titulosDescartados };
}
