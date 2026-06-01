/**
 * Equivalência fuzzy conservadora — espelha {@code AgendaEventoEquivalenciaUtil} (Java).
 * Na dúvida, NÃO fundir (ex.: processo_ref diferente ou só um dos lados preenchido).
 */
import {
  normalizarDescricaoParaChave,
  normalizarHoraParaChave,
  normalizarStatusParaChave,
} from './agenda-conteudo-key.mjs';
import { normalizarTextoPlanilha } from './normalizar-texto-planilha.mjs';

export function descricaoComoNaApi(descricao) {
  const d = normalizarTextoPlanilha(descricao);
  return d || 'Compromisso';
}

/** @param {string | null | undefined} ref */
export function normalizarProcessoRef(ref) {
  const t = normalizarTextoPlanilha(ref);
  return t || null;
}

/**
 * Ambos vazios → ok. Ambos preenchidos → devem ser iguais.
 * Só um preenchido → ambíguo (não fundir).
 */
export function processoRefCompativel(refA, refB) {
  const a = normalizarProcessoRef(refA);
  const b = normalizarProcessoRef(refB);
  if (a && b) return a === b;
  if (a || b) return false;
  return true;
}

/**
 * Equivalência base (import TXT): descrição manda; hora/status flexíveis; sem prefixo fuzzy.
 * @param {{ horaEvento?: string | null, descricao?: string | null, statusCurto?: string | null, processoRef?: string | null }} a
 * @param {{ horaEvento?: string | null, descricao?: string | null, statusCurto?: string | null, processoRef?: string | null }} b
 */
export function compromissosEquivalentes(a, b) {
  if (!processoRefCompativel(a.processoRef, b.processoRef)) return false;

  const descA = normalizarDescricaoParaChave(descricaoComoNaApi(a.descricao));
  const descB = normalizarDescricaoParaChave(descricaoComoNaApi(b.descricao));

  if (!descA && !descB) {
    return normalizarStatusParaChave(a.statusCurto) === normalizarStatusParaChave(b.statusCurto);
  }
  if (!descA || !descB) return false;

  if (descA !== descB) {
    if (descA.length < 8 || descB.length < 8) return false;
    if (!descA.includes(descB) && !descB.includes(descA)) return false;
  }

  const horaA = normalizarHoraParaChave(a.horaEvento);
  const horaB = normalizarHoraParaChave(b.horaEvento);
  if (horaA && horaB && horaA !== horaB) return false;

  return true;
}

function prefixoDescricaoEquivalente(descNormA, descNormB, horaA, horaB) {
  const horaNormA = normalizarHoraParaChave(horaA);
  const horaNormB = normalizarHoraParaChave(horaB);
  if (horaNormA && horaNormB && horaNormA !== horaNormB) return false;
  const n = Math.min(100, descNormA.length, descNormB.length);
  if (n < 40) return false;
  return descNormA.slice(0, n) === descNormB.slice(0, n);
}

/**
 * Equivalência ampliada (dedupe / upsert fuzzy): base + prefixo 100 chars + mesmo horário.
 * @param {{ horaEvento?: string | null, descricao?: string | null, statusCurto?: string | null, processoRef?: string | null }} a
 * @param {{ horaEvento?: string | null, descricao?: string | null, statusCurto?: string | null, processoRef?: string | null }} b
 */
export function compromissosEquivalentesAgenda(a, b) {
  if (!processoRefCompativel(a.processoRef, b.processoRef)) return false;
  if (compromissosEquivalentes(a, b)) return true;

  const descNormA = normalizarDescricaoParaChave(descricaoComoNaApi(a.descricao));
  const descNormB = normalizarDescricaoParaChave(descricaoComoNaApi(b.descricao));
  return prefixoDescricaoEquivalente(descNormA, descNormB, a.horaEvento, b.horaEvento);
}

/**
 * @param {{ horaEvento?: string | null, descricao?: string | null, statusCurto?: string | null, processoRef?: string | null }} a
 * @param {{ horaEvento?: string | null, descricao?: string | null, statusCurto?: string | null, processoRef?: string | null }} b
 */
export function explicarEquivalenciaAgenda(a, b) {
  if (!processoRefCompativel(a.processoRef, b.processoRef)) {
    const ra = normalizarProcessoRef(a.processoRef);
    const rb = normalizarProcessoRef(b.processoRef);
    if (ra && rb && ra !== rb) return 'processo_ref diferente';
    if (ra || rb) return 'processo_ref ambíguo (só um lado preenchido)';
  }
  if (compromissosEquivalentes(a, b)) return 'descrição/hora/status equivalentes';
  const descNormA = normalizarDescricaoParaChave(descricaoComoNaApi(a.descricao));
  const descNormB = normalizarDescricaoParaChave(descricaoComoNaApi(b.descricao));
  if (prefixoDescricaoEquivalente(descNormA, descNormB, a.horaEvento, b.horaEvento)) {
    return `prefixo ${Math.min(100, descNormA.length, descNormB.length)} chars + mesmo horário`;
  }
  return 'não equivalentes';
}

/** Cluster só é deduplicável se todos os pares forem equivalentes (conservador). */
export function clusterDedupavelConservador(cluster, rowParaEvento) {
  if (cluster.length < 2) return false;
  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      const evI = rowParaEvento(cluster[i]);
      const evJ = rowParaEvento(cluster[j]);
      if (!compromissosEquivalentesAgenda(evI, evJ)) return false;
    }
  }
  return true;
}
