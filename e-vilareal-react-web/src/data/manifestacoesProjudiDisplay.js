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
    const titular = obterTitularNomeLinha(row);
    const oposta = obterParteOpostaLinha(row);
    if (titular && oposta) return `${titular} × ${oposta}`;
    return titular || oposta || '—';
  }
  const doEmail = partesEmailLinha(row);
  return doEmail || '—';
}
