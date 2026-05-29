/**
 * Metadados extraídos do email Projudi (jsonReferencia.projudi).
 */
import { obterParteOpostaLinha, obterTitularNomeLinha } from './publicacoesDisplayHelpers.js';

function str(v) {
  return String(v ?? '').trim();
}

export function parseProjudiMeta(row) {
  const raw = row?.jsonCnjBruto ?? row?.jsonReferencia;
  if (!raw) return {};
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return o?.projudi && typeof o.projudi === 'object' ? o.projudi : {};
  } catch {
    return {};
  }
}

export function tipoMovimentoLinha(row) {
  const meta = parseProjudiMeta(row);
  return str(row?.tipoPublicacao) || str(meta.tipoMovimento) || '—';
}

export function partesEmailLinha(row) {
  const meta = parseProjudiMeta(row);
  const autor = str(meta.parteAutor);
  const reu = str(meta.parteReu);
  if (autor && reu) return `${autor} × ${reu}`;
  return autor || reu || '';
}

/** Partes do cadastro (vinculado) ou do corpo do email Projudi. */
export function formatarPartesLinha(row) {
  if (row?.statusVinculo === 'vinculado') {
    const titular = obterTitularNomeLinha(row);
    const oposta = obterParteOpostaLinha(row);
    if (titular && oposta) return `${titular} × ${oposta}`;
    return titular || oposta || '—';
  }
  const doEmail = partesEmailLinha(row);
  return doEmail || '—';
}
