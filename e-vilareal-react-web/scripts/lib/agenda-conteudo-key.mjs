/**
 * Espelha {@code AgendaEventoConteudoKeyUtil} + {@code AgendaConteudoKeyService} (Java).
 * Fonte única nos scripts Node — manter em sync com o backend.
 */
import crypto from 'node:crypto';
import { normalizarTextoPlanilha } from './normalizar-texto-planilha.mjs';

/** @param {string | null | undefined} raw */
export function normalizarDescricaoParaChave(raw) {
  let d = normalizarTextoPlanilha(raw);
  if (!d) d = 'Compromisso';
  return d
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Hora normalizada ou string vazia (sem horário fixo). */
export function normalizarHoraParaChave(val) {
  if (val == null) return '';
  const s = String(val).trim();
  if (!s || s === '.....') return '';
  const m = s.match(/^(\d{1,2})[h:.](\d{2})$/i);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length === 3 || digits.length === 4) {
    const hh = Number(digits.slice(0, digits.length - 2));
    const mm = Number(digits.slice(-2));
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }
  return '';
}

/** {@code OK} ou string vazia. */
export function normalizarStatusParaChave(raw) {
  const t = String(raw ?? '').trim();
  return t.toUpperCase() === 'OK' ? 'OK' : '';
}

export function sha256Hex(text) {
  return crypto.createHash('sha256').update(text ?? '', 'utf8').digest('hex');
}

/**
 * @param {number | string} usuarioId
 * @param {string} dataEvento YYYY-MM-DD
 * @param {string | null | undefined} horaEventoRaw
 * @param {string | null | undefined} descricaoRaw
 * @param {string | null | undefined} statusCurtoRaw
 */
export function gerarConteudoKey(usuarioId, dataEvento, horaEventoRaw, descricaoRaw, statusCurtoRaw) {
  if (usuarioId == null || !dataEvento) return null;
  const hora = normalizarHoraParaChave(horaEventoRaw);
  const desc = normalizarDescricaoParaChave(descricaoRaw);
  const status = normalizarStatusParaChave(statusCurtoRaw);
  const descHash = sha256Hex(desc);
  return `${usuarioId}|${dataEvento}|${hora}|${descHash}|${status}`;
}
