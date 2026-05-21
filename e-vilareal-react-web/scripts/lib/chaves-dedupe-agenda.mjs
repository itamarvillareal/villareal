import {
  compromissosEquivalentes,
  descricaoComoNaApi,
  normalizarHoraAgendaTxt,
  normalizarStatusAgendaTxt,
} from './agenda-local-txt.mjs';

/**
 * @param {{ hora_evento?: string | null, descricao?: string | null, status_curto?: string | null }} row
 */
export function rowParaEventoAgenda(row) {
  return {
    horaEvento: row.hora_evento ?? row.horaEvento,
    descricao: row.descricao,
    statusCurto: row.status_curto ?? row.statusCurto,
  };
}

/**
 * @param {{ hora_evento?: string | null, descricao?: string | null, status_curto?: string | null, origem?: string | null, id?: number }} row
 */
export function pontuarKeeperAgenda(row) {
  let score = 0;
  if (normalizarStatusAgendaTxt(row.status_curto) === 'OK') score += 20;
  if (normalizarHoraAgendaTxt(row.hora_evento)) score += 10;
  const origem = String(row.origem ?? '').toLowerCase();
  if (origem.includes('import-txt') || origem.includes('txt')) score += 5;
  if (origem.includes('planilha') || origem.includes('xls')) score += 1;
  score += Math.min(8, Math.floor(String(row.descricao ?? '').length / 80));
  if (descricaoComoNaApi(row.descricao) !== 'Compromisso') score += 2;
  return score;
}

/**
 * Agrupa compromissos equivalentes no mesmo dia/utilizador.
 * @param {object[]} rows
 */
export function agruparEquivalentesAgenda(rows) {
  /** @type {object[][]} */
  const clusters = [];
  for (const row of rows) {
    const ev = rowParaEventoAgenda(row);
    let cluster = null;
    for (const c of clusters) {
      if (compromissosEquivalentes(ev, rowParaEventoAgenda(c[0]))) {
        cluster = c;
        break;
      }
    }
    if (cluster) cluster.push(row);
    else clusters.push([row]);
  }
  return clusters.filter((c) => c.length >= 2);
}

/**
 * @param {object[]} cluster
 */
export function escolherKeeperAgenda(cluster) {
  const sorted = [...cluster].sort((a, b) => {
    const sa = pontuarKeeperAgenda(a);
    const sb = pontuarKeeperAgenda(b);
    if (sb !== sa) return sb - sa;
    return Number(a.id) - Number(b.id);
  });
  return sorted[0];
}

/**
 * @param {string | Date} dataEvento
 */
export function dataEventoIso(dataEvento) {
  if (dataEvento instanceof Date) {
    return dataEvento.toISOString().slice(0, 10);
  }
  const s = String(dataEvento ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s.slice(0, 10);
}
