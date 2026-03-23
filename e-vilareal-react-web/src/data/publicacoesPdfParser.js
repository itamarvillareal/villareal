/**
 * Parser determinístico de PDFs de publicações (ex.: e-mail Jusbrasil).
 *
 * Arquitetura (camadas, auditável, sem LLM na extração principal):
 * 1) Texto: `publicacoesPdfExtract` (pdf.js no browser) → string bruta.
 * 2) Normalização + remoção leve de ruído: `normalizarTextoPdf`, `removerRuidoCabecalhoRodape`.
 * 3) Segmentação: `segmentarBlocosPublicacoes` (marcadores Título/Processo/NR.PROCESSO…; fallback por múltiplos CNJ).
 * 4) Por bloco: CNJ preferencial após rótulos (`extrairCnjPreferencialDoBloco`), datas, diário, teor após «Publicação»,
 *    status de indisponível/segredo, tipo e resumo heurísticos, hash do teor.
 * 5) Deduplicação: `deduplicarParseados` — chave CNJ normalizado + data publicação + hash teor.
 * 6) Vínculo interno: `publicacoesVinculoProcessos` (índice CNJ × cod. cliente / proc.).
 * 7) Persistência: `publicacoesStorage` + UI `PublicacoesProcessos` (prévia antes de gravar).
 * 8) Camada 2 DataJud: `publicacoesPipeline` + `datajudApiClient` (validação; teor permanece do PDF).
 */

import { prepararTextoParaSegmentacao } from './publicacoesTextoLimpeza.js';
import { extrairTribunalTextualDoDiario } from './publicacoesCnjTribunal.js';

/** Padrão CNJ flexível (espaços/OCR) */
export const RE_CNJ_GLOBAL =
  /\b(\d{7})\s*[-–]\s*(\d{2})\s*\.\s*(\d{4})\s*\.\s*(\d)\s*\.\s*(\d{2})\s*\.\s*(\d{4})\b/g;

const RE_CNJ_LINHA = new RegExp(RE_CNJ_GLOBAL.source, 'i');

const MARCADORES_INDISPONIVEL =
  /ARQUIVOS\s+DIGITAIS\s+INDISPON[IÍ]VEIS|PROCESSO\s+EM\s+SEGREDO\s+DE\s+JUSTI[ÇC]A|OS\s+ARQUIVOS\s+DA\s+INTIMA[ÇC][AÃ]O\s+N[AÃ]O\s+FORAM\s+PUBLICADOS/i;

/** dd/mm/aaaa ou dd/mm/aa (PDFs e e-mails costumam usar ano com 2 dígitos) */
const RE_DATA_BR = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;

const ROTULOS_PROCESSO =
  /(?:^|\n)\s*(?:N[ÚU]MERO\s+[ÚU]NICO|NR\.?\s*PROCESSO|Processo\s*n[º°]?|Autos\s*n[º°]?|N[úu]mero\s+do\s+processo)\s*[:.]?\s*/i;

const ROTULO_PUBLICACAO = /(?:^|\n)\s*Publica[çc][aã]o\s*[:.]?\s*/i;

const ROTULO_DISP = /Data\s+de\s+disponibiliza[çc][aã]o/i;
const ROTULO_PUB = /Data\s+de\s+publica[çc][aã]o/i;
/** Captura data na mesma linha do rótulo (comum em PDFs Jusbrasil) */
const RE_INLINE_DISP = /Data\s+de\s+disponibiliza[çc][aã]o\s*[:.]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i;
const RE_INLINE_PUB = /Data\s+de\s+publica[çc][aã]o\s*[:.]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i;
const ROTULO_DIARIO = /\bDi[áa]rio\b/i;

/**
 * Normaliza texto extraído do PDF: quebras, espaços, hífens unicode.
 */
export function normalizarTextoPdf(texto) {
  let t = String(texto ?? '');
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(/[\u00AD\u200B\uFEFF]/g, '');
  t = t.replace(/[–—]/g, '-');
  t = t.replace(/ +/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

/** Remove ruídos comuns de e-mail / paginação (heurística leve). */
export function removerRuidoCabecalhoRodape(texto) {
  const linhas = String(texto).split('\n');
  const out = [];
  for (const raw of linhas) {
    const L = raw.trim();
    if (!L) {
      out.push('');
      continue;
    }
    if (/^p[áa]gina\s+\d+/i.test(L)) continue;
    if (/^gmail\s*$/i.test(L)) continue;
    if (/^mostrar mensagem original/i.test(L)) continue;
    if (/^on\s+.+\s+wrote:/i.test(L)) continue;
    out.push(raw);
  }
  return out.join('\n');
}

export function normalizarCnjParaChave(cnj) {
  const m = String(cnj ?? '').match(RE_CNJ_LINHA);
  if (!m) return '';
  return `${m[1]}-${m[2]}.${m[3]}.${m[4]}.${m[5]}.${m[6]}`.toUpperCase();
}

/**
 * Normaliza data brasileira para dd/mm/aaaa (expande ano com 2 dígitos: 26 → 2026).
 * Heurística: 00–69 → 2000–2069; 70–99 → 1970–1999 (comum em textos jurídicos recentes).
 */
export function normalizarDataBrCompleta(s) {
  const t = String(s ?? '').trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return '';
  const dd = String(Number(m[1])).padStart(2, '0');
  const mm = String(Number(m[2])).padStart(2, '0');
  let y = m[3];
  if (y.length === 2) {
    const n = Number(y);
    y = String(n <= 69 ? 2000 + n : 1900 + n);
  }
  if (y.length !== 4) return '';
  return `${dd}/${mm}/${y}`;
}

export function extrairPrimeiroCnj(texto) {
  RE_CNJ_GLOBAL.lastIndex = 0;
  const m = RE_CNJ_GLOBAL.exec(String(texto ?? ''));
  if (!m) return null;
  return normalizarCnjParaChave(m[0]);
}

/** Primeira ocorrência bruta do CNJ no bloco (para auditoria). */
export function extrairCnjBrutoDoBloco(bloco) {
  RE_CNJ_GLOBAL.lastIndex = 0;
  const m = RE_CNJ_GLOBAL.exec(String(bloco ?? ''));
  return m ? String(m[0]).trim() : '';
}

function extrairTermosEncontrados(bloco) {
  const m = String(bloco).match(/Termos\s+encontrados\s*[:.]?\s*([^\n]+)/i);
  return m ? m[1].trim().slice(0, 500) : '';
}

/** Rótulos comuns antes do número (Jusbrasil / tribunais). */
const ROTULOS_LINHA_PARA_CNJ = [
  /N[ÚU]MERO\s+[ÚU]NICO\s*[:.]?\s*([^\n]+)/i,
  /NR\.?\s*PROCESSO\s*[:.]?\s*([^\n]+)/i,
  /Processo\s*n[º°\.]?\s*([^\n]+)/i,
  /Autos\s*n[º°\.]?\s*([^\n]+)/i,
  /N[úu]mero\s+do\s+processo\s*[:.]?\s*([^\n]+)/i,
];

/**
 * Prioriza CNJ logo após rótulos; senão primeiro CNJ válido no bloco.
 */
export function extrairCnjPreferencialDoBloco(bloco) {
  const b = String(bloco ?? '');
  for (const re of ROTULOS_LINHA_PARA_CNJ) {
    const m = b.match(re);
    if (m?.[1]) {
      const cnj = extrairPrimeiroCnj(m[1]);
      if (cnj) return cnj;
    }
  }
  return extrairPrimeiroCnj(b);
}

/** Segmento de justiça (campo J do CNJ) — rótulo legível para auditoria. */
const SEGMENTO_J_CNJ = {
  1: 'STF',
  2: 'Conselho Nacional de Justiça',
  3: 'STJ',
  4: 'STJ',
  5: 'TST',
  6: 'TRF',
  7: 'TRF',
  8: 'Justiça estadual (TJ)',
  9: 'TRF',
};

export function inferirOrgaoTribunalDoCnj(cnjNormalizado) {
  const s = String(cnjNormalizado ?? '');
  const m = s.match(/^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const j = m[4];
  return SEGMENTO_J_CNJ[Number(j)] ?? `Segmento CNJ ${j}`;
}

/**
 * Hash determinístico do teor (deduplicação).
 */
export function hashTeorNormalizado(teor) {
  const n = String(teor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  let h = 5381;
  for (let i = 0; i < n.length; i++) {
    h = (h * 33) ^ n.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function chaveDeduplicacao(cnjNorm, dataPublicacaoBr, hashTeor) {
  const d = String(dataPublicacaoBr ?? '').replace(/\D/g, '') || '00000000';
  return `${cnjNorm}|${d}|${hashTeor}`;
}

/**
 * Segmenta o texto em blocos de publicação (heurística por marcadores + CNJ).
 */
export function segmentarBlocosPublicacoes(textoNorm) {
  const t = String(textoNorm);
  if (!t) return [];

  const candidatos = [];

  const reInicio = new RegExp(
    String.raw`\n(?=(?:T[ií]tulo|Processo|N[ÚU]MERO\s+[ÚU]NICO|NR\.?\s*PROCESSO|Processo\s*n[º°]?|Autos\s*n[º°]?|N[úu]mero\s+do\s+processo)\b)`,
    'gi'
  );

  let idx = 0;
  let m;
  const starts = [];
  while ((m = reInicio.exec(t)) !== null) {
    starts.push(m.index + 1);
  }

  if (starts.length >= 1) {
    for (let i = 0; i < starts.length; i++) {
      const a = starts[i];
      const b = i + 1 < starts.length ? starts[i + 1] : t.length;
      const chunk = t.slice(a, b).trim();
      if (chunk.length > 20) candidatos.push(chunk);
    }
  }

  if (candidatos.length === 0) {
    return segmentarFallbackPorMultiplosCnj(t);
  }

  return candidatos;
}

/** Quando não há marcadores claros: fatiar entre ocorrências de CNJ (cada ocorrência pode ser um bloco). */
function segmentarFallbackPorMultiplosCnj(t) {
  const matches = [...t.matchAll(new RegExp(RE_CNJ_GLOBAL.source, 'gi'))];
  if (matches.length === 0) return [];

  const blocos = [];
  for (let i = 0; i < matches.length; i++) {
    const start = Math.max(0, matches[i].index - 400);
    const end = i + 1 < matches.length ? matches[i + 1].index : t.length;
    const chunk = t.slice(start, end).trim();
    if (chunk.length > 15) blocos.push(chunk);
  }
  return blocos;
}

function extrairDatasDoBloco(bloco) {
  const datas = [];
  let m;
  const re = new RegExp(RE_DATA_BR.source, 'g');
  while ((m = re.exec(bloco)) !== null) {
    const norm = normalizarDataBrCompleta(`${m[1]}/${m[2]}/${m[3]}`);
    if (norm) datas.push(norm);
  }
  return datas;
}

/** Primeira data na mesma linha do rótulo «Data de disponibilização/publicação». */
function extrairDataRotuloMesmaLinha(bloco, reInline) {
  const m = String(bloco ?? '').match(reInline);
  if (!m?.[1]) return null;
  return normalizarDataBrCompleta(m[1]);
}

/**
 * Datas na ordem de aparição no bloco (Jusbrasil costuma: disponibilização antes da publicação).
 */
function extrairParDatasPorOrdemNoBloco(bloco) {
  const encontradas = [];
  const re = new RegExp(RE_DATA_BR.source, 'g');
  let m;
  while ((m = re.exec(bloco)) !== null) {
    const norm = normalizarDataBrCompleta(`${m[1]}/${m[2]}/${m[3]}`);
    if (norm) encontradas.push({ norm, index: m.index });
  }
  if (encontradas.length >= 2) {
    encontradas.sort((a, b) => a.index - b.index);
    return { disp: encontradas[0].norm, pub: encontradas[1].norm };
  }
  if (encontradas.length === 1) {
    return { disp: null, pub: encontradas[0].norm };
  }
  return { disp: null, pub: null };
}

function extrairCampoAposRotulo(bloco, reRotulo) {
  const m = reRotulo.exec(bloco);
  if (!m) return null;
  const pos = m.index + m[0].length;
  const resto = bloco.slice(pos, pos + 800);
  const linhas = resto.split('\n').slice(0, 8);
  for (const linha of linhas) {
    const L = String(linha ?? '').trim();
    if (!L) continue;
    const dm = L.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
    if (dm) {
      return normalizarDataBrCompleta(`${dm[1]}/${dm[2]}/${dm[3]}`);
    }
  }
  return null;
}

function extrairDiario(bloco) {
  const m = bloco.match(new RegExp(`${ROTULO_DIARIO.source}\\s*[:.]?\\s*([^\\n]+)`, 'i'));
  if (m) return m[1].trim().slice(0, 200);
  return null;
}

/**
 * Extrai teor: após "Publicação" até fim do bloco (ou próximo marcador interno raro).
 */
export function extrairTeorPublicacao(bloco) {
  const b = String(bloco);
  const m = ROTULO_PUBLICACAO.exec(b);
  if (!m) {
    const idx = b.search(/\bPublica[çc][aã]o\b/i);
    if (idx === -1) return { teor: '', encontrouRotulo: false };
    const after = b.slice(idx);
    const teor = after.replace(/^\s*Publica[çc][aã]o\s*[:.]?\s*/i, '').trim();
    return { teor: limparTeorFinal(teor), encontrouRotulo: true };
  }
  const pos = m.index + m[0].length;
  let teor = b.slice(pos).trim();
  teor = limparTeorFinal(teor);
  return { teor, encontrouRotulo: true };
}

function limparTeorFinal(teor) {
  return String(teor)
    .replace(/^\s*:\s*/m, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function classificarStatusTeor(teor) {
  const t = String(teor ?? '').trim();
  if (!t) return 'vazio';
  if (MARCADORES_INDISPONIVEL.test(t)) {
    if (/SEGREDO/i.test(t)) return 'segredo';
    if (/INTIMA[ÇC][AÃ]O.*N[AÃ]O\s+FORAM\s+PUBLICADOS/i.test(t)) return 'sem_arquivos_publicados';
    if (/INDISPON/i.test(t)) return 'indisponivel';
    return 'indisponivel';
  }
  return 'integral';
}

const PALAVRAS_TIPO = [
  ['segredo de justiça', 'segredo'],
  ['intimação', 'intimacao'],
  ['sentença', 'sentenca'],
  ['acórdão', 'acordao'],
  ['recurso', 'recurso'],
  ['embargos', 'embargo'],
  ['distribui', 'distribu'],
  ['ato ordinatório', 'ordinat'],
  ['despacho', 'despacho'],
  ['certidão', 'certidao'],
  ['decisão', 'decisao'],
  ['mandado', 'mandado'],
  ['agravo', 'agravo'],
];

export function classificarTipoPublicacao(teor, statusTeor) {
  if (statusTeor !== 'integral' && statusTeor !== 'vazio') {
    if (statusTeor === 'segredo') return 'segredo de justiça';
    if (statusTeor === 'indisponivel' || statusTeor === 'sem_arquivos_publicados') return 'indisponível / sem arquivos';
  }
  const low = String(teor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const [label, needle] of PALAVRAS_TIPO) {
    if (low.includes(needle)) return label;
  }
  return 'outros';
}

export function gerarResumoHeuristico(teor, tipo, statusTeor) {
  if (statusTeor !== 'integral' && statusTeor !== 'vazio') {
    if (statusTeor === 'segredo') return 'Processo em segredo de justiça (sem teor publicado).';
    if (statusTeor === 'indisponivel') return 'Arquivos digitais indisponíveis.';
    if (statusTeor === 'sem_arquivos_publicados') return 'Arquivos da intimação não foram publicados.';
    if (statusTeor === 'vazio') return 'Sem texto de publicação identificado.';
  }
  const t = String(teor ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return 'Sem conteúdo textual extraído.';
  const frase = t.split(/(?<=[.!?])\s+/)[0] || t.slice(0, 220);
  return frase.length > 240 ? `${frase.slice(0, 237)}…` : frase;
}

/**
 * Parse de um bloco bruto → registro parcial (antes de vínculo e dedup).
 */
export function parsearBlocoPublicacao(bloco, indiceBloco) {
  const cnj = extrairCnjPreferencialDoBloco(bloco);
  const cnjBruto = extrairCnjBrutoDoBloco(bloco);
  const termosEncontrados = extrairTermosEncontrados(bloco);
  const datas = extrairDatasDoBloco(bloco);
  const inlineDisp = extrairDataRotuloMesmaLinha(bloco, RE_INLINE_DISP);
  const inlinePub = extrairDataRotuloMesmaLinha(bloco, RE_INLINE_PUB);
  let dataDisp =
    inlineDisp ||
    extrairCampoAposRotulo(bloco, ROTULO_DISP) ||
    null;
  let dataPub =
    inlinePub ||
    extrairCampoAposRotulo(bloco, ROTULO_PUB) ||
    null;
  if (!dataDisp || !dataPub) {
    const par = extrairParDatasPorOrdemNoBloco(bloco);
    if (!dataDisp) dataDisp = par.disp;
    if (!dataPub) dataPub = par.pub;
  }
  if (datas.length >= 2) {
    if (!dataDisp) dataDisp = datas[0];
    if (!dataPub) dataPub = datas[1];
  } else if (datas.length === 1 && !dataPub) {
    dataPub = datas[0];
  }
  const diario = extrairDiario(bloco);
  const { teor, encontrouRotulo } = extrairTeorPublicacao(bloco);
  const statusTeor = classificarStatusTeor(teor);
  const tipo = classificarTipoPublicacao(teor, statusTeor);
  const resumo = gerarResumoHeuristico(teor, tipo, statusTeor);
  const h = hashTeorNormalizado(teor);
  const orgaoTribunal = cnj ? inferirOrgaoTribunalDoCnj(cnj) : diario ? String(diario).slice(0, 80) : null;
  const tribunalPdf = extrairTribunalTextualDoDiario(diario) || null;

  return {
    indiceBloco,
    numeroCnj: cnj || '',
    processoCnjNormalizado: cnj || '',
    processoCnjBruto: cnjBruto,
    termosEncontrados,
    dataDisponibilizacao: dataDisp,
    dataPublicacao: dataPub,
    diario,
    orgaoTribunal,
    tribunalPdf,
    teorIntegral: teor,
    encontrouRotuloPublicacao: encontrouRotulo,
    statusTeor,
    tipoPublicacao: tipo,
    resumoAutomatico: resumo,
    hashTeor: h,
    observacoesTecnicas: !encontrouRotulo && teor ? 'Teor capturado sem rótulo explícito «Publicação».' : '',
  };
}

/**
 * Pipeline completo: texto PDF normalizado → lista de registros parseados + métricas.
 */
export function processarTextoPdfPublicacoes(textoBruto) {
  const limpo = prepararTextoParaSegmentacao(textoBruto);
  const blocos = segmentarBlocosPublicacoes(limpo);
  const parseados = blocos.map((b, i) => parsearBlocoPublicacao(b, i));
  const metricas = {
    blocosDetectados: blocos.length,
    comCnj: parseados.filter((p) => p.numeroCnj).length,
    semTeor: parseados.filter((p) => p.statusTeor === 'vazio').length,
    indisponivel: parseados.filter((p) => p.statusTeor !== 'integral' && p.statusTeor !== 'vazio').length,
  };
  return { limpo, blocos, parseados, metricas };
}

/**
 * Deduplica: mesma chave cnj|dataPub|hash → uma entrada; mesmo CNJ e hash diferente → mantém ambas.
 */
export function deduplicarParseados(parseados) {
  const visto = new Map();
  const saida = [];
  const descartados = [];
  for (const p of parseados) {
    const cnj = p.processoCnjNormalizado || 'SEM_CNJ';
    const dp = String(p.dataPublicacao ?? '').replace(/\D/g, '') || 'SEM_DATA';
    const key = `${cnj}|${dp}|${p.hashTeor}`;
    if (visto.has(key)) {
      descartados.push({ key, motivo: 'duplicata_exata' });
      continue;
    }
    visto.set(key, true);
    saida.push(p);
  }
  return { itens: saida, duplicatasDescartadas: descartados.length };
}
