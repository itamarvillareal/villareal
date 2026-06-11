/**
 * Metadados extraídos do email Projudi (jsonReferencia.projudi).
 */
import { obterParteClienteNomeLinha, obterParteOpostaLinha } from './publicacoesDisplayHelpers.js';

function str(v) {
  return String(v ?? '').trim();
}

export function parseProjudiMeta(row) {
  const raw = row?.jsonCnjBruto ?? row?.jsonReferencia;
  if (!raw) return {};
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (o?.projudi && typeof o.projudi === 'object') return o.projudi;
    if (o?.trt && typeof o.trt === 'object') return o.trt;
    return {};
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

const ENTIDADES_HTML_NOMEADAS = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&aacute;': 'á',
  '&Aacute;': 'Á',
  '&eacute;': 'é',
  '&Eacute;': 'É',
  '&iacute;': 'í',
  '&Iacute;': 'Í',
  '&oacute;': 'ó',
  '&Oacute;': 'Ó',
  '&uacute;': 'ú',
  '&Uacute;': 'Ú',
  '&atilde;': 'ã',
  '&Atilde;': 'Ã',
  '&otilde;': 'õ',
  '&Otilde;': 'Õ',
  '&ccedil;': 'ç',
  '&Ccedil;': 'Ç',
  '&acirc;': 'â',
  '&ecirc;': 'ê',
  '&ocirc;': 'ô',
  '&agrave;': 'à',
  '&ordm;': 'º',
  '&ordf;': 'ª',
};

/** Decodifica entidades HTML que o Projudi envia no corpo do email. */
export function decodificarEntidadesHtml(texto) {
  let h = str(texto);
  if (!h) return '';
  h = h
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => {
      const cp = parseInt(hex, 16);
      return cp > 0 && cp < 0x10ffff ? String.fromCodePoint(cp) : m;
    })
    .replace(/&#(\d+);/g, (m, dec) => {
      const cp = Number(dec);
      return cp > 0 && cp < 0x10ffff ? String.fromCodePoint(cp) : m;
    })
    .replace(/&[a-z]+;/gi, (m) => ENTIDADES_HTML_NOMEADAS[m] ?? ENTIDADES_HTML_NOMEADAS[m.toLowerCase()] ?? m);
  return h;
}

function normalizarParaComparacao(linha) {
  return decodificarEntidadesHtml(str(linha))
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9áàâãéèêíìîóòôõúùûç.]/g, '');
}

/**
 * Remove conteúdo repetido no teor. Os emails do Projudi repetem o mesmo bloco
 * (plain + HTML) várias vezes, com quebras simples (\n) e duplas (\n\n) misturadas,
 * então deduplicamos no nível de LINHA mantendo a ordem da primeira aparição.
 */
function linhaPareceCssIsolada(linha) {
  const t = str(linha);
  if (!t) return false;
  if (/^[{}]$/.test(t)) return true;
  if (/^\}\s*$/.test(t)) return true;
  if (/^[.#@*a-z0-9_-]+\s*\{\s*$/i.test(t)) return true;
  if (/^[a-z-]+\s*:\s*[^;{]+;\s*$/i.test(t)) return true;
  return false;
}

function blocoCssComecaEm(linhas, idx) {
  const t = str(linhas[idx]);
  if (!t) return false;
  if (/^[.#@*a-z0-9_-]+\s*\{\s*$/i.test(t)) return true;
  return /^[.#@*a-z0-9_,\s-]+\{/.test(t) && t.includes('{');
}

function pularBlocoCss(linhas, start) {
  let depth = 0;
  for (let i = start; i < linhas.length; i++) {
    const linha = linhas[i] ?? '';
    for (const c of linha) {
      if (c === '{') depth++;
      if (c === '}') depth--;
    }
    if (depth <= 0 && linha.includes('}')) return i + 1;
  }
  return linhas.length;
}

/** Remove CSS órfão que vazou do HTML do email TRT/PJe. */
export function limparCssDoTeor(teor) {
  const texto = decodificarEntidadesHtml(str(teor));
  if (!texto) return '';
  const linhas = texto.split('\n');
  const unicos = [];
  let i = 0;
  while (i < linhas.length) {
    if (blocoCssComecaEm(linhas, i)) {
      i = pularBlocoCss(linhas, i);
      continue;
    }
    const raw = linhas[i];
    if (linhaPareceCssIsolada(raw)) {
      i++;
      continue;
    }
    unicos.push(raw);
    i++;
  }
  return unicos.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function ehTrt(row) {
  const origem = str(row?.origemImportacao).toUpperCase();
  if (origem === 'TRT') return true;
  const meta = parseProjudiMeta(row);
  return Boolean(meta?.classeJudicial || meta?.orgaoJulgador);
}

function montarTeorTrtDoMeta(row) {
  const meta = parseProjudiMeta(row);
  const linhas = [];
  const cnj = str(row?.numeroProcessoEncontrado || row?.numero_processo_cnj);
  if (cnj) linhas.push(`Número do Processo: ${cnj}`);
  if (meta.classeJudicial) linhas.push(`Classe Judicial: ${meta.classeJudicial}`);
  if (meta.orgaoJulgador) linhas.push(`Órgão Julgador: ${meta.orgaoJulgador}`);
  if (meta.parteAutor) linhas.push(`Autor: ${meta.parteAutor}`);
  if (meta.parteReu) linhas.push(`Réu: ${meta.parteReu}`);
  if (meta.tipoMovimento) linhas.push(`Movimentação: ${meta.tipoMovimento}`);
  return linhas.length ? linhas.join('\n') : '';
}

function teorPareceCssOuVazio(teor) {
  const t = str(teor);
  if (!t) return true;
  if (/margin\s*:\s*0/i.test(t) && /font-size\s*:/i.test(t)) return true;
  if (/^\s*\*\s*\{/.test(t)) return true;
  return false;
}

/** Teor legível no modal e na lista (Projudi + TRT). */
export function teorParaExibicao(row) {
  const raw = str(row?.teor || row?.teorIntegral);
  let t = limparCssDoTeor(deduplicarTeorExibicao(decodificarEntidadesHtml(raw)));
  if (ehTrt(row) && teorPareceCssOuVazio(t)) {
    t = montarTeorTrtDoMeta(row) || t;
  }
  return t || '—';
}

export function deduplicarTeorExibicao(teor) {
  const texto = decodificarEntidadesHtml(str(teor));
  if (!texto) return '';
  const linhas = texto.split('\n');
  const unicos = [];
  const normVistos = [];
  for (const raw of linhas) {
    const t = raw.trim();
    if (!t) {
      if (unicos.length && unicos[unicos.length - 1] !== '') unicos.push('');
      continue;
    }
    const norm = normalizarParaComparacao(t);
    if (norm.length < 12) {
      unicos.push(t);
      continue;
    }
    if (normVistos.some((n) => n === norm || n.includes(norm) || norm.includes(n))) continue;
    normVistos.push(norm);
    unicos.push(t);
  }
  while (unicos.length && unicos[unicos.length - 1] === '') unicos.pop();
  return unicos.length ? unicos.join('\n') : texto;
}

export function formatarPartesLinha(row) {
  if (row?.statusVinculo === 'vinculado') {
    const parteCliente = obterParteClienteNomeLinha(row);
    const oposta = obterParteOpostaLinha(row);
    if (parteCliente && oposta) return `${parteCliente} × ${oposta}`;
    return parteCliente || oposta || '—';
  }
  const doEmail = partesEmailLinha(row);
  return doEmail || '—';
}
