/**
 * Alias "hj" (hoje) em campos de data — preenche com a data atual no formato esperado.
 */

export function hojeDdMmYyyy() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** yyyy-mm-dd no fuso local (para inputs que gravam ISO). */
export function hojeIsoLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Converte texto de data (ISO, dd/mm/aaaa, dd-mm-aaaa) para yyyy-mm-dd da API.
 * @param {string|Date|null|undefined} val
 * @returns {string|null}
 */
export function dataNascimentoTextoParaIso(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  let s = String(val).trim();
  if (!s) return null;
  if (s.includes('T')) s = s.split('T')[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (br) {
    const dd = Number(br[1]);
    const mm = Number(br[2]);
    const yyyy = Number(br[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Se o texto for exatamente "hj" (trim, ignora maiúsculas), retorna a data de hoje no formato;
 * caso contrário null.
 * @param {'br' | 'iso'} formato - 'br' = dd/mm/aaaa, 'iso' = yyyy-mm-dd
 */
export function resolverAliasHojeEmTexto(valor, formato) {
  const t = String(valor ?? '').trim();
  if (!/^hj$/i.test(t)) return null;
  return formato === 'iso' ? hojeIsoLocal() : hojeDdMmYyyy();
}

/** Mantém só dígitos e insere barras: dd, dd/mm ou dd/mm/aaaa. */
export function mascararDigitosDataBr(valor) {
  const digits = String(valor ?? '').replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

/** Extrai dia, mês e ano quando o texto já contém barras (edição por segmento). */
export function extrairSegmentosDataBr(valor) {
  const parts = String(valor ?? '').split('/');
  const dd = (parts[0] ?? '').replace(/\D/g, '').slice(0, 2);
  const mm = (parts[1] ?? '').replace(/\D/g, '').slice(0, 2);
  const yyyy = parts.slice(2).join('').replace(/\D/g, '').slice(0, 4);
  return { dd, mm, yyyy };
}

/** Remonta dd/mm/aaaa preservando segmentos já presentes no texto. */
export function montarDataBrDeSegmentos({ dd, mm, yyyy }, quantidadePartes) {
  if (!dd && !mm && !yyyy) return '';
  if (quantidadePartes >= 3 || yyyy.length > 0) return `${dd}/${mm}/${yyyy}`;
  if (quantidadePartes >= 2 || mm.length > 0) return `${dd}/${mm}`;
  return dd;
}

/** Formata texto que já contém barras sem reagrupar todos os dígitos em sequência. */
export function formatarDataBrInputComBarras(valor) {
  const parts = String(valor ?? '').split('/');
  return montarDataBrDeSegmentos(extrairSegmentosDataBr(valor), parts.length);
}

export function formatarDataBrInput(valor) {
  const t = String(valor ?? '').trim();
  if (!t) return '';
  if (t.includes('/')) return formatarDataBrInputComBarras(t);
  return mascararDigitosDataBr(t);
}

/** Índice do segmento (0=dia, 1=mês, 2=ano) conforme posição do cursor. */
export function indiceSegmentoDataBrPorPosicao(valor, posicao) {
  const before = String(valor ?? '').slice(0, posicao);
  const barras = (before.match(/\//g) || []).length;
  return Math.min(barras, 2);
}

/** Reposiciona o cursor após formatar, mantendo o foco no segmento editado. */
export function calcularPosicaoCursorDataBr(valorAntes, valorDepois, cursorAntes) {
  const antes = String(valorAntes ?? '');
  const depois = String(valorDepois ?? '');
  const cursor = typeof cursorAntes === 'number' ? cursorAntes : antes.length;

  if (antes.includes('/')) {
    const segIdx = indiceSegmentoDataBrPorPosicao(antes, cursor);
    const partsAntes = antes.split('/');
    let offset = 0;
    for (let i = 0; i < segIdx; i++) {
      offset += (partsAntes[i]?.length ?? 0) + 1;
    }
    const digitosNoSegmento = antes.slice(offset, cursor).replace(/\D/g, '').length;
    const partsDepois = depois.split('/');
    let pos = 0;
    for (let i = 0; i < segIdx; i++) {
      pos += (partsDepois[i]?.length ?? 0) + 1;
    }
    pos += Math.min(digitosNoSegmento, (partsDepois[segIdx] ?? '').replace(/\D/g, '').length);
    return Math.min(pos, depois.length);
  }

  const digitosAntes = antes.slice(0, cursor).replace(/\D/g, '').length;
  let digitos = 0;
  for (let i = 0; i < depois.length; i++) {
    if (/\d/.test(depois[i])) {
      digitos++;
      if (digitos >= digitosAntes) return i + 1;
    }
  }
  return depois.length;
}

/** Valor ISO, dd/mm/aaaa ou parcial digitado → dd/mm/aaaa para exibição. */
export function dataNascimentoParaExibicaoBr(val) {
  if (val == null || val === '') return '';
  const s = String(val).trim();
  if (!s) return '';
  const iso = dataNascimentoTextoParaIso(s);
  if (iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  return formatarDataBrInput(s);
}

/** Ao sair do campo: normaliza data válida ou limpa se incompleta/inválida. */
export function normalizarDataNascimentoBrAoBlur(val) {
  const t = String(val ?? '').trim();
  if (!t) return '';
  const iso = dataNascimentoTextoParaIso(t);
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
