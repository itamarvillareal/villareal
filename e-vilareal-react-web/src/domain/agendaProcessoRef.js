import { padCliente } from '../data/processosDadosRelatorio.js';

/**
 * Referência compacta para navegação Processos (≤120 chars na API Java).
 * Formato: código cliente 8 dígitos | número interno do processo (≥1).
 */
export function montarProcessoRefAgenda(codigoClienteRaw, numeroInternoRaw) {
  const cod = padCliente(codigoClienteRaw);
  const n = Number(numeroInternoRaw);
  if (!cod || !Number.isFinite(n) || n < 1) return '';
  return `${cod}|${Math.floor(n)}`;
}

export function parseProcessoRefAgenda(ref) {
  const s = String(ref ?? '').trim();
  const m = /^(\d{8})\|(\d+)$/.exec(s);
  if (!m) return null;
  const proc = Number(m[2]);
  if (!Number.isFinite(proc) || proc < 1) return null;
  return { codCliente: m[1], proc };
}

/**
 * Resolve cliente×proc a partir do evento na Agenda (API, localStorage ou agendamento em lote).
 */
export function extrairChaveProcessoEventoAgenda(ev) {
  if (!ev || typeof ev !== 'object') return null;
  const pr = parseProcessoRefAgenda(ev.processoRef);
  if (pr) return pr;

  const ccRaw = ev.codCliente ?? ev.clienteId;
  const procRaw = ev.proc ?? ev.numeroInterno ?? ev.processoId;
  if (ccRaw == null || String(ccRaw).trim() === '') return null;
  const procNum = Number(procRaw);
  if (!Number.isFinite(procNum) || procNum < 1) return null;
  return { codCliente: padCliente(ccRaw), proc: Math.floor(procNum) };
}
