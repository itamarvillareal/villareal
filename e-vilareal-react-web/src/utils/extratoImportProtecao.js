import { dataLancamentoParaIso } from './ofx.js';

/**
 * Penúltima data distinta já importada no banco.
 * Limita a mesclagem aos últimos ~2 dias calendário — evita duplicar meses fechados
 * quando o extrato completo volta com FITID/descrição alterados.
 *
 * @param {object[]} existente — lançamentos já gravados na API
 * @returns {string|null} YYYY-MM-DD ou null (primeira importação)
 */
export function calcularDataCorteImportacaoExtrato(existente) {
  const vistos = new Set();
  const datas = [];
  for (const t of existente || []) {
    const iso = dataLancamentoParaIso(t?.data ?? t?.dataLancamento);
    if (!iso || vistos.has(iso)) continue;
    vistos.add(iso);
    datas.push(iso);
  }
  if (datas.length === 0) return null;
  datas.sort();
  if (datas.length === 1) return datas[0];
  return datas[datas.length - 2];
}

/**
 * @param {object[]} rows
 * @param {object[]} existente
 * @param {{ modo?: 'mesclar'|'substituir' }} [opts]
 */
export function aplicarProtecaoDataCorteImportacao(rows, existente, opts = {}) {
  const modo = opts.modo ?? 'mesclar';
  const totalArquivo = rows?.length ?? 0;
  if (modo !== 'mesclar') {
    return { rows: rows || [], dataCorte: null, ignoradosPorCorte: 0, totalArquivo };
  }

  const dataCorte = calcularDataCorteImportacaoExtrato(existente);
  if (!dataCorte) {
    return { rows: rows || [], dataCorte: null, ignoradosPorCorte: 0, totalArquivo };
  }

  const filtrados = [];
  let ignoradosPorCorte = 0;
  for (const r of rows || []) {
    const iso = dataLancamentoParaIso(r?.data);
    if (iso && iso >= dataCorte) filtrados.push(r);
    else ignoradosPorCorte += 1;
  }
  return { rows: filtrados, dataCorte, ignoradosPorCorte, totalArquivo };
}

export function formatarDataCorteBr(dataCorteIso) {
  if (!dataCorteIso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataCorteIso));
  if (!m) return String(dataCorteIso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Igual a {@link aplicarProtecaoDataCorteImportacao}, mas com data de corte já calculada no servidor.
 * @param {object[]} rows
 * @param {string|null} dataCorteIso YYYY-MM-DD
 */
export function aplicarProtecaoDataCorteImportacaoComData(rows, dataCorteIso) {
  const totalArquivo = rows?.length ?? 0;
  if (!dataCorteIso) {
    return { rows: rows || [], dataCorte: null, ignoradosPorCorte: 0, totalArquivo };
  }
  const dataCorte = String(dataCorteIso).slice(0, 10);
  const filtrados = [];
  let ignoradosPorCorte = 0;
  for (const r of rows || []) {
    const iso = dataLancamentoParaIso(r?.data);
    if (iso && iso >= dataCorte) filtrados.push(r);
    else ignoradosPorCorte += 1;
  }
  return { rows: filtrados, dataCorte, ignoradosPorCorte, totalArquivo };
}
