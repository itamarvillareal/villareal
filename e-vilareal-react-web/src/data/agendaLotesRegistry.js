import { criarLoteRefAgenda, removerSufixoUltimoAgendamento } from '../domain/agendaLoteRef.js';

const STORAGE_KEY = 'e-vilareal-agenda-lotes-v1';

function loadAll() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(lista) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    window.dispatchEvent(new CustomEvent('vilareal:agenda-lotes-atualizados'));
  } catch {
    /* ignore */
  }
}

export function listarLotesAgendaRegistry() {
  return loadAll()
    .filter((l) => l && String(l.loteRef ?? '').trim())
    .sort((a, b) => String(b.atualizadoEm || b.criadoEm || '').localeCompare(String(a.atualizadoEm || a.criadoEm || '')));
}

export function obterLoteAgendaRegistry(loteRef) {
  const id = String(loteRef ?? '').trim();
  if (!id) return null;
  return loadAll().find((l) => String(l.loteRef) === id) ?? null;
}

export function upsertLoteAgendaRegistry(lote) {
  const id = String(lote?.loteRef ?? '').trim();
  if (!id) return { ok: false, reason: 'lote-ref-vazio' };
  const now = new Date().toISOString();
  const lista = loadAll().filter((l) => String(l?.loteRef ?? '') !== id);
  const prev = obterLoteAgendaRegistry(id);
  lista.push({
    ...prev,
    ...lote,
    loteRef: id,
    criadoEm: prev?.criadoEm || lote.criadoEm || now,
    atualizadoEm: now,
  });
  saveAll(lista);
  return { ok: true };
}

export function removerLoteAgendaRegistry(loteRef) {
  const id = String(loteRef ?? '').trim();
  if (!id) return { ok: false };
  saveAll(loadAll().filter((l) => String(l?.loteRef ?? '') !== id));
  return { ok: true };
}

/** Deriva linhas únicas (por data) a partir dos eventos materializados. */
export function linhasFromEventosLote(eventos) {
  const byDate = new Map();
  for (const ev of Array.isArray(eventos) ? eventos : []) {
    const dataBr = String(ev?.dataBr ?? ev?.data ?? '').trim();
    if (!dataBr) continue;
    if (!byDate.has(dataBr)) {
      byDate.set(dataBr, {
        dataBr,
        hora: String(ev?.hora ?? ev?.horaEvento ?? '').trim().slice(0, 5),
        informacao: String(ev?.descricao ?? ev?.informacao ?? '').trim(),
      });
    }
  }
  return Array.from(byDate.values()).sort((a, b) => {
    const pa = a.dataBr.split('/').reverse().join('');
    const pb = b.dataBr.split('/').reverse().join('');
    return pa.localeCompare(pb);
  });
}

export function textoBaseFromLinhas(linhas) {
  const lista = Array.isArray(linhas) ? linhas : [];
  for (const l of lista) {
    const t = removerSufixoUltimoAgendamento(l?.informacao);
    if (t) return t;
  }
  return '';
}

export function novoRegistroLoteAgenda({
  loteRef = criarLoteRefAgenda(),
  textoBase = '',
  horaPadrao = '',
  processo = null,
  usuarioIds = [],
  linhas = [],
  eventos = [],
} = {}) {
  return {
    loteRef,
    textoBase,
    horaPadrao,
    processo,
    usuarioIds: [...usuarioIds],
    linhas: [...linhas],
    eventos: [...eventos],
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
}
