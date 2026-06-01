import {
  clusterDedupavelConservador,
  compromissosEquivalentesAgenda,
  descricaoComoNaApi,
  explicarEquivalenciaAgenda,
} from './agenda-equivalencia-conservadora.mjs';
import { normalizarHoraParaChave } from './agenda-conteudo-key.mjs';

/**
 * @param {{ hora_evento?: string | null, descricao?: string | null, status_curto?: string | null, processo_ref?: string | null, processoRef?: string | null }} row
 */
export function rowParaEventoAgenda(row) {
  return {
    horaEvento: row.hora_evento ?? row.horaEvento,
    descricao: row.descricao,
    statusCurto: row.status_curto ?? row.statusCurto,
    processoRef: row.processo_ref ?? row.processoRef ?? null,
  };
}

/**
 * @param {{ hora_evento?: string | null, descricao?: string | null, status_curto?: string | null, origem?: string | null, id?: number }} row
 */
export function pontuarKeeperAgenda(row) {
  let score = 0;
  const st = String(row.status_curto ?? row.statusCurto ?? '').trim().toUpperCase();
  if (st === 'OK') score += 20;
  if (normalizarHoraParaChave(row.hora_evento ?? row.horaEvento)) score += 10;
  const origem = String(row.origem ?? '').toLowerCase();
  if (origem.includes('import-txt') || origem.includes('txt')) score += 5;
  if (origem.includes('planilha') || origem.includes('xls')) score += 1;
  score += Math.min(8, Math.floor(String(row.descricao ?? '').length / 80));
  if (descricaoComoNaApi(row.descricao) !== 'Compromisso') score += 2;
  return score;
}

/**
 * @param {object} keeper
 * @param {object[]} cluster
 */
export function explicarKeeperAgenda(keeper, cluster) {
  const score = pontuarKeeperAgenda(keeper);
  const parts = [`score=${score}`];
  const origem = String(keeper.origem ?? '');
  if (origem) parts.push(`origem=${origem}`);
  if (keeper.processo_ref ?? keeper.processoRef) {
    parts.push(`processo_ref=${keeper.processo_ref ?? keeper.processoRef}`);
  }
  const outros = cluster.filter((r) => r.id !== keeper.id);
  if (outros.length) {
    const motivos = outros.map((o) => explicarEquivalenciaAgenda(rowParaEventoAgenda(keeper), rowParaEventoAgenda(o)));
    parts.push(`equiv=${[...new Set(motivos)].join('; ')}`);
  }
  return parts.join(', ');
}

/**
 * Agrupa compromissos equivalentes no mesmo dia/utilizador (conservador: todos os pares).
 * @param {object[]} rows
 */
export function agruparEquivalentesAgenda(rows) {
  /** @type {object[][]} */
  const clusters = [];
  for (const row of rows) {
    const ev = rowParaEventoAgenda(row);
    let cluster = null;
    for (const c of clusters) {
      const todosEquivalentes = c.every((other) =>
        compromissosEquivalentesAgenda(ev, rowParaEventoAgenda(other))
      );
      if (todosEquivalentes) {
        cluster = c;
        break;
      }
    }
    if (cluster) cluster.push(row);
    else clusters.push([row]);
  }
  return clusters
    .filter((c) => c.length >= 2)
    .filter((c) => clusterDedupavelConservador(c, rowParaEventoAgenda));
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
 * Clusters potenciais ignorados por ambiguidade (não deduplicáveis).
 * @param {object[]} rows
 */
export function agruparAmbiguosAgenda(rows) {
  /** @type {object[][]} */
  const clusters = [];
  for (const row of rows) {
    const ev = rowParaEventoAgenda(row);
    let cluster = null;
    for (const c of clusters) {
      if (compromissosEquivalentesAgenda(ev, rowParaEventoAgenda(c[0]))) {
        cluster = c;
        break;
      }
    }
    if (cluster) cluster.push(row);
    else clusters.push([row]);
  }
  return clusters.filter((c) => c.length >= 2 && !clusterDedupavelConservador(c, rowParaEventoAgenda));
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
