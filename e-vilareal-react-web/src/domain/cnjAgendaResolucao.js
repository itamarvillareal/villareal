/**
 * CNJ na agenda costuma aparecer truncado (ex.: 5717034.38.2025 em vez do CNJ completo).
 * Este módulo extrai candidatos do texto e casa com `numeroProcessoNovo` no histórico local.
 */

import { padCliente } from '../data/processosDadosRelatorio.js';

function apenasDigitos(v) {
  return String(v ?? '').replace(/\D/g, '');
}

/** Primeiros 13 dígitos do CNJ (NNNNNNN + DD + AAAA) a partir de 20 dígitos ou texto mascarado. */
export function prefixoCnj13DigitosDeNumeroProcesso(raw) {
  const d = apenasDigitos(raw);
  if (d.length >= 13) return d.slice(0, 13);
  return d.length >= 11 ? d : '';
}

/**
 * Ex.: 5717034-38.2025.8.09.0137 → 5717034.38.2025
 * @param {string} raw
 * @returns {string}
 */
export function formatarResumoCnjParaLinhaAgenda(raw) {
  const d = apenasDigitos(raw);
  if (d.length >= 13) {
    return `${d.slice(0, 7)}.${d.slice(7, 9)}.${d.slice(9, 13)}`;
  }
  const s = String(raw ?? '').trim();
  const m = /^(\d{7})-(\d{2})\.(\d{4})\b/.exec(s);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  return s || 's/n';
}

/**
 * Uniformiza o texto da agenda antes de extrair CNJ (espaços especiais, Unicode).
 * @param {string} texto
 * @returns {string}
 */
export function normalizarTextoAgendaParaExtracaoCnj(texto) {
  return String(texto ?? '')
    .normalize('NFC')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

/**
 * Candidatos em dígitos: CNJ completo (20) e prefixos parciais (≥11) encontrados no texto.
 * @param {string} texto
 * @returns {string[]}
 */
export function extrairChavesCandidatasCnjDoTextoAgenda(texto) {
  const s = normalizarTextoAgendaParaExtracaoCnj(texto);
  const vistos = new Set();
  const out = [];

  function push(d) {
    if (!d || d.length < 11 || vistos.has(d)) return;
    vistos.add(d);
    out.push(d);
  }

  const reCnj = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g;
  let m;
  while ((m = reCnj.exec(s)) !== null) {
    const d = apenasDigitos(m[0]);
    if (d.length === 20) push(d);
  }

  const re20 = /\b\d{20}\b/g;
  while ((m = re20.exec(s)) !== null) {
    push(m[0]);
  }

  // Padrão agenda / formulário: 5717034.38.2025 (com ou sem espaços ao redor de . e -)
  const reParcial = /\b(\d{7})\s*[.\-]\s*(\d{2})\s*\.\s*(\d{4})\b/g;
  while ((m = reParcial.exec(s)) !== null) {
    push(`${m[1]}${m[2]}${m[3]}`);
  }

  // Mesmo padrão colado a "nº", "Nº", "n°" (sem word boundary estrito antes do dígito)
  const reAposNo = /(?:^|[^\d])(?:n[ºo°]|autos)\s*(\d{7})\s*[.\-]\s*(\d{2})\s*\.\s*(\d{4})\b/gi;
  while ((m = reAposNo.exec(s)) !== null) {
    push(`${m[1]}${m[2]}${m[3]}`);
  }

  return out;
}

function cnjDigitosCombinaCandidato(digitosProcesso, candidato) {
  if (!digitosProcesso || !candidato) return false;
  if (candidato.length >= 15) {
    return digitosProcesso === candidato || digitosProcesso.startsWith(candidato);
  }
  return digitosProcesso.startsWith(candidato);
}

/**
 * @param {string} texto
 * @param {Record<string, unknown>} storeHistorico — objeto `loadStore()` de processos
 * @returns {{ codCliente: string, proc: number }[]}
 */
export function encontrarProcessosHistoricoPorTextoAgenda(texto, storeHistorico) {
  const candidatos = extrairChavesCandidatasCnjDoTextoAgenda(texto);
  if (candidatos.length === 0) return [];

  const matches = new Map();
  for (const regRaw of Object.values(storeHistorico || {})) {
    if (!regRaw || typeof regRaw !== 'object') continue;
    const cod = padCliente(regRaw.codCliente ?? '1');
    const proc = Number(String(regRaw.proc ?? '').replace(/\D/g, ''));
    if (!cod || !Number.isFinite(proc) || proc < 1) continue;
    const digitosNovo = apenasDigitos(String(regRaw.numeroProcessoNovo ?? '').trim());
    const digitosVelho = apenasDigitos(String(regRaw.numeroProcessoVelho ?? '').trim());

    let casou = false;
    for (const cand of candidatos) {
      if (digitosNovo.length >= 11 && cnjDigitosCombinaCandidato(digitosNovo, cand)) {
        casou = true;
        break;
      }
      if (digitosVelho.length >= 11 && cnjDigitosCombinaCandidato(digitosVelho, cand)) {
        casou = true;
        break;
      }
    }
    if (casou) {
      const key = `${cod}:${proc}`;
      matches.set(key, { codCliente: cod, proc });
    }
  }
  return [...matches.values()];
}

/**
 * Tipo da audiência: texto antes do primeiro `(` quando parece descrição longa; senão heurística.
 * @param {string} descricao
 * @returns {string}
 */
export function extrairTipoAudienciaDaDescricaoAgenda(descricao) {
  const s = String(descricao ?? '').trim();
  if (!s) return 'Audiência';
  const idx = s.indexOf('(');
  if (idx > 3) {
    const head = s.slice(0, idx).trim();
    if (head.length >= 3 && head.length < 120) return head;
  }
  const m = /^(.+?)\s+—\s*Proc\./i.exec(s);
  if (m) return m[1].trim();
  return 'Audiência';
}

/**
 * Trecho após ", no " (órgão / comarca), case insensitive.
 * @param {string} descricao
 * @returns {string}
 */
export function extrairOrgaoCompetenciaDaDescricaoAgenda(descricao) {
  const s = String(descricao ?? '');
  const m = /,\s*no\s+(.+)$/i.exec(s.trim());
  return m ? m[1].trim() : '';
}
