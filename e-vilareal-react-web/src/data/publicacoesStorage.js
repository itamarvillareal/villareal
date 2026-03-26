/**
 * Persistência local das publicações importadas (prévia confirmada).
 * v2: campos Camada 1 + Camada 2 (DataJud) + score + auditoria.
 */

import { chaveDeduplicacao, normalizarCnjParaChave, normalizarDataBrCompleta } from './publicacoesPdfParser.js';

export const STORAGE_PUBLICACOES_IMPORTADAS = 'vilareal.processos.publicacoes.v2';

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function migrarItemV1ParaV2(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    v: 2,
    processoCnjBruto: item.processoCnjBruto ?? '',
    termosEncontrados: item.termosEncontrados ?? '',
    hashArquivo: item.hashArquivo ?? '',
    tribunalPdf: item.tribunalPdf ?? null,
    tribunalCnj: item.tribunalCnj ?? null,
    classeProcessual: item.classeProcessual ?? null,
    assuntos: item.assuntos ?? null,
    ultimoMovimentoCnj: item.ultimoMovimentoCnj ?? null,
    dataUltimoMovimentoCnj: item.dataUltimoMovimentoCnj ?? null,
    statusValidacaoCnj: item.statusValidacaoCnj ?? '',
    scoreConfianca: item.scoreConfianca ?? '',
    jsonCnjBruto: item.jsonCnjBruto ?? null,
    divergenciasPdfCnj: item.divergenciasPdfCnj ?? [],
    importacaoConfirmadaEm: item.importacaoConfirmadaEm ?? null,
    importadoPor: item.importadoPor ?? 'local',
    vinculoOrigem: item.vinculoOrigem ?? '',
  };
}

export function loadPublicacoesImportadas() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PUBLICACOES_IMPORTADAS);
    const p = safeParse(raw);
    if (p?.v === 2 && Array.isArray(p.itens)) {
      return p.itens.filter((x) => x && typeof x === 'object');
    }
    const rawV1 = window.localStorage.getItem('vilareal.processos.publicacoes.v1');
    const p1 = safeParse(rawV1);
    if (p1?.v === 1 && Array.isArray(p1.itens)) {
      const mig = p1.itens.map(migrarItemV1ParaV2);
      savePublicacoesImportadas(mig);
      try {
        window.localStorage.removeItem('vilareal.processos.publicacoes.v1');
      } catch {
        /* ignore */
      }
      return mig;
    }
    return [];
  } catch {
    return [];
  }
}

export function savePublicacoesImportadas(itens) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PUBLICACOES_IMPORTADAS, JSON.stringify({ v: 2, itens }));
  } catch {
    /* ignore */
  }
}

/** Remove todas as publicações persistidas localmente (v2 e legado v1). */
export function limparTodasPublicacoesImportadas() {
  if (typeof window === 'undefined') return { ok: true };
  try {
    savePublicacoesImportadas([]);
    window.localStorage.removeItem('vilareal.processos.publicacoes.v1');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function novoId() {
  return `pub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Grava itens confirmados; evita duplicata pela chave composta CNJ+data+hash teor.
 */
export function appendPublicacoesConfirmadas(itensNovos, arquivoOrigem, meta = {}) {
  const existentes = loadPublicacoesImportadas();
  const chaves = new Set(
    existentes.map((e) => e.hashDedup || chaveDeduplicacao(e.processoCnjNormalizado, e.dataPublicacao, e.hashTeor))
  );
  const importadoEm = new Date().toISOString();
  const adicionados = [];
  const hashArquivo = meta.hashArquivo ?? '';
  const confirmEm = meta.importacaoConfirmadaEm ?? importadoEm;

  for (const raw of itensNovos) {
    const cnj = normalizarCnjParaChave(raw.numeroCnj || raw.processoCnjNormalizado);
    const h = raw.hashTeor;
    const dp =
      normalizarDataBrCompleta(String(raw.dataPublicacao ?? '').trim()) || String(raw.dataPublicacao ?? '').trim();
    const ddisp = raw.dataDisponibilizacao
      ? normalizarDataBrCompleta(String(raw.dataDisponibilizacao).trim()) || String(raw.dataDisponibilizacao).trim()
      : null;
    const key = chaveDeduplicacao(cnj, dp, h);
    if (chaves.has(key)) continue;
    chaves.add(key);
    adicionados.push({
      id: novoId(),
      dataImportacao: importadoEm,
      importacaoConfirmadaEm: confirmEm,
      arquivoOrigem: String(arquivoOrigem ?? ''),
      hashArquivo,
      processoCnjBruto: String(raw.processoCnjBruto ?? ''),
      processoCnjNormalizado: cnj,
      numero_processo_cnj: cnj,
      procInterno: String(raw.procInterno ?? ''),
      codCliente: String(raw.codCliente ?? ''),
      cliente: String(raw.cliente ?? ''),
      termosEncontrados: String(raw.termosEncontrados ?? ''),
      diario: raw.diario ?? null,
      tribunalPdf: raw.tribunalPdf ?? null,
      tribunalCnj: raw.tribunalCnj ?? null,
      orgaoTribunal: raw.orgaoTribunal ?? null,
      orgaoJulgador: raw.orgaoJulgador ?? null,
      classeProcessual: raw.classeProcessual ?? null,
      assuntos: raw.assuntos ?? null,
      grau: raw.grau ?? null,
      nivelSigilo: raw.nivelSigilo ?? null,
      dataDisponibilizacao: ddisp,
      dataPublicacao: dp || null,
      tipoPublicacao: raw.tipoPublicacao ?? '',
      teorIntegral: raw.teorIntegral ?? '',
      resumoPublicacao: raw.resumoAutomatico ?? raw.resumoPublicacao ?? '',
      statusPublicacao: raw.statusTeor ?? raw.statusPublicacao ?? '',
      statusVinculo: raw.statusVinculo ?? '',
      statusValidacaoCnj: raw.statusValidacaoCnj ?? '',
      scoreConfianca: raw.scoreConfianca ?? '',
      ultimoMovimentoCnj: raw.ultimoMovimentoCnj ?? null,
      dataUltimoMovimentoCnj: raw.dataUltimoMovimentoCnj ?? null,
      divergenciasPdfCnj: Array.isArray(raw.divergenciasPdfCnj) ? raw.divergenciasPdfCnj : [],
      hashTeor: h,
      hashDedup: key,
      observacoesTecnicas: raw.observacoesTecnicas ?? '',
      jsonCnjBruto: raw.jsonCnjBruto ?? null,
      linkArquivoOrigem: raw.linkArquivoOrigem ?? '',
      importadoPor: raw.importadoPor ?? 'local',
      vinculoOrigem: raw.vinculoOrigem ?? '',
    });
  }
  savePublicacoesImportadas([...adicionados, ...existentes]);
  return { gravados: adicionados.length, ignoradosDuplicata: itensNovos.length - adicionados.length };
}

/**
 * Atualiza um registro já gravado (ex.: vínculo manual).
 */
export function updatePublicacaoImportada(id, patch) {
  const itens = loadPublicacoesImportadas();
  const idx = itens.findIndex((x) => x.id === id);
  if (idx < 0) return { ok: false, motivo: 'nao_encontrado' };
  const merged = { ...itens[idx], ...patch };
  const next = [...itens];
  next[idx] = merged;
  savePublicacoesImportadas(next);
  return { ok: true };
}
