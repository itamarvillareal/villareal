/**
 * Leitura de fases de processo em ficheiros txt (Dropbox «Banco de Dados»).
 *
 * Fase (conteúdo): `fase/1000/<centena>/<nº cliente>/*.21.1.<proc>.*.txt`
 *   — número interno do processo = segmento entre o 3.º e o 4.º ponto do nome.
 *
 * Observação da fase: `Gerais/1000/<centena>/<nº cliente>/*.146.1.<proc>.txt`
 *   — mesma regra de pastas (centena VB: 0–99→0, 100–199→100, …; cliente 728→700).
 *
 * Status do processo (VBA): `Gerais/1000/<centena>/<nº cliente>/<cod8>.Status.Processo<proc>.Processos.txt`
 *   — `proc` com mínimo 2 caracteres no nome (`03`, `1469`, …); conteúdo `INATIVO` → inativar na API
 *     e não importar fase/observação dos outros txt.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  centenaPastaClienteHistorico,
  formatCod8,
  formatProcNomeArquivo,
  pastaNumeroClienteHistorico,
  readOneLineFile,
  SEGMENTO_MIL,
} from './historico-local-txt-paths.mjs';

export const TIPO_FASE_ARQUIVO = '21.1';
export const TIPO_OBSERVACAO_FASE = '146.1';
export const SUFIXO_STATUS_PROCESSO = 'Processos';

export function resolverBaseBancoDados() {
  const env = process.env.VILAREAL_BANCO_DADOS_BASE?.trim();
  if (env) return env;
  return path.join(process.env.HOME || '', 'Dropbox', 'Banco de Dados');
}

export function defaultBaseFaseMil() {
  return path.join(resolverBaseBancoDados(), 'fase', SEGMENTO_MIL);
}

export function defaultBaseGeraisObservacaoMil() {
  return path.join(resolverBaseBancoDados(), 'Gerais', SEGMENTO_MIL);
}

/**
 * @param {string} fileName
 * @param {string} tipoMeio ex.: `21.1` ou `146.1`
 * @returns {{ cod8: string, codNum: number, numeroInterno: number } | null}
 */
export function parseNomeArquivoCodTipoProc(fileName, tipoMeio) {
  const base = path.basename(fileName, path.extname(fileName));
  const parts = base.split('.');
  if (parts.length < 4) return null;

  const codRaw = parts[0];
  if (!/^\d{8}$/.test(codRaw)) return null;

  const tipoParts = String(tipoMeio).split('.');
  if (tipoParts.length !== 2) return null;
  if (parts[1] !== tipoParts[0] || parts[2] !== tipoParts[1]) return null;

  const procRaw = parts[3];
  const numeroInterno = Number.parseInt(procRaw, 10);
  if (!Number.isFinite(numeroInterno) || numeroInterno < 1) return null;

  const codNum = Number.parseInt(codRaw, 10);
  return { cod8: codRaw, codNum, numeroInterno };
}

/** @param {string} fileName */
export function parseNomeArquivoFase21_1(fileName) {
  return parseNomeArquivoCodTipoProc(fileName, TIPO_FASE_ARQUIVO);
}

/** @param {string} fileName */
export function parseNomeArquivoObservacao146_1(fileName) {
  return parseNomeArquivoCodTipoProc(fileName, TIPO_OBSERVACAO_FASE);
}

/**
 * Nome VBA: `Cod_Cliente & ".Status.Processo" & Class_do_Processo & ".Processos.txt"`
 * Ex.: `00000001.Status.Processo03.Processos.txt` → proc 3
 * @param {string} fileName
 * @returns {{ cod8: string, codNum: number, numeroInterno: number } | null}
 */
export function parseNomeArquivoStatusProcesso(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  const parts = base.split('.');
  if (parts.length !== 4) return null;

  const codRaw = parts[0];
  if (!/^\d{8}$/.test(codRaw)) return null;
  if (parts[1] !== 'Status') return null;
  if (parts[3] !== SUFIXO_STATUS_PROCESSO) return null;

  const procSeg = parts[2];
  if (!procSeg.startsWith('Processo')) return null;
  const procRaw = procSeg.slice('Processo'.length);
  if (!procRaw) return null;

  const numeroInterno = Number.parseInt(procRaw, 10);
  if (!Number.isFinite(numeroInterno) || numeroInterno < 1) return null;

  const codNum = Number.parseInt(codRaw, 10);
  return { cod8: codRaw, codNum, numeroInterno };
}

/**
 * @param {string} baseGeraisMil
 * @param {number} codNum
 * @param {number} numeroInterno
 */
export function caminhoStatusProcessoEsperado(baseGeraisMil, codNum, numeroInterno) {
  const cent = centenaPastaClienteHistorico(codNum);
  const pastaCli = pastaNumeroClienteHistorico(codNum);
  const cod8 = formatCod8(codNum);
  const procSeg = formatProcNomeArquivo(numeroInterno);
  if (!procSeg) return null;
  const nomeOk = `${cod8}.Status.Processo${procSeg}.${SUFIXO_STATUS_PROCESSO}.txt`;
  return path.join(baseGeraisMil, String(cent), pastaCli, nomeOk);
}

/**
 * Conteúdo do txt de status — processo inativo no legado.
 * @param {string | null | undefined} textoBruto
 */
export function ehStatusProcessoInativo(textoBruto) {
  return ehFaseTxtInativo(textoBruto);
}

/**
 * Regra de negócio: txt `Status.Processo` com `INATIVO` → inativo; qualquer outro conteúdo (ou ausência de ficheiro) → ativo.
 * @param {string | null | undefined} textoBruto
 * @param {{ temArquivo?: boolean }} [opts]
 */
export function resolverAtivoFromStatusProcessoTxt(textoBruto, opts = {}) {
  const statusInativo = ehStatusProcessoInativo(textoBruto);
  const bruto = textoBruto == null ? null : String(textoBruto).trim();
  return {
    ativo: !statusInativo,
    statusInativo,
    statusBruto: bruto === '' ? null : bruto,
    temArquivoStatus: opts.temArquivo === true,
    avisoStatus: statusInativo
      ? 'inativo_status_processo'
      : bruto
        ? 'status_nao_inativo'
        : opts.temArquivo
          ? 'status_vazio'
          : 'status_ausente',
  };
}

/**
 * Lê o ficheiro VBA `Cod_Cliente.Status.Processo<Class>.Processos.txt` para um processo.
 * @param {number} codNum
 * @param {number} numeroInterno
 * @param {{ baseBanco?: string, baseGeraisMil?: string }} [opts]
 */
export function lerStatusProcessoTxt(codNum, numeroInterno, opts = {}) {
  const baseGeraisMil =
    opts.baseGeraisMil ?? path.join(opts.baseBanco ?? resolverBaseBancoDados(), 'Gerais', SEGMENTO_MIL);
  const esperado = caminhoStatusProcessoEsperado(baseGeraisMil, codNum, numeroInterno);
  if (!esperado || !fs.existsSync(esperado)) {
    return resolverAtivoFromStatusProcessoTxt(null, { temArquivo: false });
  }
  const texto = readOneLineFile(esperado);
  return {
    ...resolverAtivoFromStatusProcessoTxt(texto, { temArquivo: true }),
    arquivoStatus: esperado,
    cod8: formatCod8(codNum),
    codNum,
    numeroInterno,
  };
}

/**
 * @param {string} baseGeraisMil
 * @param {number} codNum
 * @returns {Array<ReturnType<typeof lerStatusProcessoTxt> & { cod8: string, codNum: number, numeroInterno: number, arquivoStatus: string }>}
 */
export function listarStatusProcessoPorCliente(baseGeraisMil, codNum) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const row of iterarStatusProcesso(baseGeraisMil, { clienteFiltro: codNum })) {
    const key = `${row.cod8}|${row.numeroInterno}`;
    const parsed = resolverAtivoFromStatusProcessoTxt(row.texto, { temArquivo: true });
    map.set(key, {
      ...parsed,
      cod8: row.cod8,
      codNum: row.codNum,
      numeroInterno: row.numeroInterno,
      arquivoStatus: row.arquivo,
    });
  }
  return [...map.values()].sort((a, b) => a.numeroInterno - b.numeroInterno);
}

const FASES_CANONICAS = [
  'Ag. Documentos',
  'Ag. Peticionar',
  'Ag. Verificação',
  'Protocolo / Movimentação',
  'Aguardando Providência',
  'Procedimento Adm.',
  'Em Andamento',
];

function buildFaseAliasMap() {
  const m = new Map();
  const add = (k, v) => {
    const nk = normalizarChaveFase(k);
    if (nk) m.set(nk, v);
  };
  for (const c of FASES_CANONICAS) add(c, c);
  add('Aguardando documentos', 'Ag. Documentos');
  add('Ag documentos', 'Ag. Documentos');
  add('Aguardando peticionar', 'Ag. Peticionar');
  add('Aguardando peticionamento', 'Ag. Peticionar');
  add('Aguardando verificacao', 'Ag. Verificação');
  add('Ag verificacao', 'Ag. Verificação');
  add('Protocolo', 'Protocolo / Movimentação');
  add('Movimentacao', 'Protocolo / Movimentação');
  add('Movimentação', 'Protocolo / Movimentação');
  add('Aguardando providencia', 'Aguardando Providência');
  add('Procedimento adm', 'Procedimento Adm.');
  add('Em andamento', 'Em Andamento');
  return m;
}

const FASE_ALIAS_PARA_CANONICA = buildFaseAliasMap();

function normalizarChaveFase(s) {
  if (s == null) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/\s+/g, ' ');
}

function faseProcessualCompactaPt(s) {
  return String(s ?? '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

function canonicalizarFase(val) {
  const raw = String(val ?? '').trim();
  if (!raw) return '';
  if (FASES_CANONICAS.includes(raw)) return raw;
  const hit = FASE_ALIAS_PARA_CANONICA.get(normalizarChaveFase(raw));
  if (hit) return hit;
  const c = faseProcessualCompactaPt(raw);
  if (!c) return '';
  if (c.includes('protoc') && c.includes('moviment')) return 'Protocolo / Movimentação';
  if (c.includes('aguard') && c.includes('provid')) return 'Aguardando Providência';
  if (c.includes('procadministrativo') || (c.includes('proced') && c.includes('adm'))) {
    return 'Procedimento Adm.';
  }
  const agPrefix = c.startsWith('ag');
  if (agPrefix && c.includes('docu') && (c.includes('ment') || c.includes('met'))) {
    return 'Ag. Documentos';
  }
  if (agPrefix && c.includes('petic') && (c.includes('ar') || c.includes('ionar') || c.includes('icion'))) {
    return 'Ag. Peticionar';
  }
  if (agPrefix && (c.includes('verif') || c.includes('verificacao'))) return 'Ag. Verificação';
  if (c.includes('emandamento')) return 'Em Andamento';
  return '';
}

function normalizarChaveFaseCompacta(s) {
  return faseProcessualCompactaPt(s);
}

/** Abreviaturas legadas nos txt de `fase/` (fora do mapa da planilha). */
const LEGADO_FASE_TXT = new Map([
  ['emandamento', 'Em Andamento'],
  ['pet', 'Ag. Peticionar'],
  ['verific', 'Ag. Verificação'],
  ['doc', 'Ag. Documentos'],
  ['aguarprovid', 'Aguardando Providência'],
  ['procedadm', 'Procedimento Adm.'],
  ['protocolo', 'Protocolo / Movimentação'],
  ['movimentacao', 'Protocolo / Movimentação'],
]);

/**
 * Processos marcados como inativos no legado — não importar fase.
 * @param {string | null | undefined} textoBruto
 */
export function ehFaseTxtInativo(textoBruto) {
  const raw = textoBruto == null ? '' : String(textoBruto).trim();
  if (!raw) return false;
  const c = faseProcessualCompactaPt(raw);
  return c === 'inativo' || c === 'inativos';
}

/**
 * @param {string | null | undefined} textoBruto
 * @returns {{ faseCanonica: string | null, aviso: string | null }}
 */
export function normalizarTextoFaseTxt(textoBruto) {
  const raw = textoBruto == null ? '' : String(textoBruto).trim();
  if (!raw) return { faseCanonica: null, aviso: 'vazio' };
  if (ehFaseTxtInativo(raw)) {
    return { faseCanonica: null, aviso: 'inativo_ignorado' };
  }

  const canon = canonicalizarFase(raw);
  if (canon) return { faseCanonica: canon, aviso: null };

  const legado = LEGADO_FASE_TXT.get(normalizarChaveFaseCompacta(raw));
  if (legado) return { faseCanonica: legado, aviso: 'legado_abrev' };

  if (raw.length > 80) {
    return { faseCanonica: null, aviso: 'texto_longo_nao_fase' };
  }

  return { faseCanonica: null, aviso: `nao_reconhecida:${raw.slice(0, 40)}` };
}

/**
 * @param {string | null | undefined} textoBruto
 * @returns {string | null}
 */
export function normalizarObservacaoFaseTxt(textoBruto) {
  if (textoBruto == null) return null;
  const t = String(textoBruto).trim();
  return t.length > 0 ? t : null;
}

/**
 * Caminho esperado para observação 146.1 (para diagnóstico).
 * @param {string} baseGeraisMil
 * @param {number} codNum
 * @param {number} numeroInterno
 */
export function caminhoObservacaoFaseEsperado(baseGeraisMil, codNum, numeroInterno) {
  const cent = centenaPastaClienteHistorico(codNum);
  const pastaCli = pastaNumeroClienteHistorico(codNum);
  const cod8 = formatCod8(codNum);
  const procSeg = String(numeroInterno).padStart(Math.max(2, String(numeroInterno).length), '0');
  const nomeOk = `${cod8}.146.1.${procSeg}.txt`;
  return path.join(baseGeraisMil, String(cent), pastaCli, nomeOk);
}

/**
 * @param {string} dir
 * @param {(fileName: string) => object | null} parseNome
 * @param {(abs: string) => string | null} readTexto
 * @param {{ clienteFiltro?: number | null, origem?: string }} [opts]
 */
function* iterarTxtEmDiretorio(dir, parseNome, readTexto, opts = {}) {
  if (!fs.existsSync(dir)) return;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* iterarTxtEmDiretorio(abs, parseNome, readTexto, opts);
      continue;
    }
    if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.txt')) continue;

    const parsed = parseNome(ent.name);
    if (!parsed) continue;
    if (opts.clienteFiltro != null && parsed.codNum !== opts.clienteFiltro) continue;

    const texto = readTexto(abs);
    yield {
      ...parsed,
      texto,
      arquivo: abs,
      origem: opts.origem ?? 'desconhecida',
    };
  }
}

/**
 * Árvore `fase/1000/<cent>/<cliente>/` e pastas legadas `fase/01`…`fase/99` (txt na raiz).
 * @param {string} baseRaizFase — pasta `fase` (pai de `1000`)
 * @param {{ clienteFiltro?: number | null }} [opts]
 */
export function* iterarFases21_1(baseRaizFase, opts = {}) {
  const mil = path.join(baseRaizFase, SEGMENTO_MIL);
  yield* iterarTxtEmDiretorio(
    mil,
    parseNomeArquivoFase21_1,
    (abs) => readOneLineFile(abs),
    { ...opts, origem: 'fase/1000' }
  );

  let top;
  try {
    top = fs.readdirSync(baseRaizFase, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of top) {
    if (!ent.isDirectory() || ent.name === SEGMENTO_MIL) continue;
    if (!/^\d{1,3}$/.test(ent.name)) continue;
    const legado = path.join(baseRaizFase, ent.name);
    yield* iterarTxtEmDiretorio(
      legado,
      parseNomeArquivoFase21_1,
      (abs) => readOneLineFile(abs),
      { ...opts, origem: `fase/${ent.name}` }
    );
  }
}

/**
 * @param {string} baseGeraisMil — `Gerais/1000`
 * @param {{ clienteFiltro?: number | null }} [opts]
 */
export function* iterarObservacoesFase146_1(baseGeraisMil, opts = {}) {
  yield* iterarTxtEmDiretorio(
    baseGeraisMil,
    parseNomeArquivoObservacao146_1,
    (abs) => readOneLineFile(abs),
    { ...opts, origem: 'Gerais/1000/146.1' }
  );
}

/**
 * @param {string} baseGeraisMil — `Gerais/1000`
 * @param {{ clienteFiltro?: number | null }} [opts]
 */
export function* iterarStatusProcesso(baseGeraisMil, opts = {}) {
  yield* iterarTxtEmDiretorio(
    baseGeraisMil,
    parseNomeArquivoStatusProcesso,
    (abs) => readOneLineFile(abs),
    { ...opts, origem: 'Gerais/1000/Status.Processo' }
  );
}

function scoreOrigemFase(origem) {
  if (origem === 'fase/1000') return 2;
  if (String(origem).startsWith('fase/')) return 1;
  return 0;
}

/** @param {object} novo @param {object} prev */
function preferirEntradaFase(novo, prev) {
  const sN = scoreOrigemFase(novo.origemFase);
  const sP = scoreOrigemFase(prev.origemFase);
  if (sN !== sP) return sN > sP;
  return (novo.mtimeMs ?? 0) >= (prev.mtimeMs ?? 0);
}

/**
 * Combina ficheiros de fase (21.1) e observação (146.1).
 * @param {string} baseRaizFase
 * @param {string} baseGeraisMil
 * @param {{ clienteFiltro?: number | null }} [opts]
 */
export function levantarFasesProcessos(baseRaizFase, baseGeraisMil, opts = {}) {
  /** @type {Map<string, object>} */
  const map = new Map();

  for (const row of iterarStatusProcesso(baseGeraisMil, opts)) {
    const key = `${row.cod8}|${row.numeroInterno}`;
    const inativo = ehStatusProcessoInativo(row.texto);
    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(row.arquivo).mtimeMs;
    } catch {
      /* ignore */
    }
    const prev = map.get(key) ?? {
      cod8: row.cod8,
      codNum: row.codNum,
      numeroInterno: row.numeroInterno,
    };
    map.set(key, {
      ...prev,
      statusBruto: row.texto,
      statusInativo: inativo,
      arquivoStatus: row.arquivo,
      origemStatus: row.origem,
      avisoStatus: inativo ? 'inativo_status_processo' : row.texto?.trim() ? 'status_nao_inativo' : 'status_vazio',
      mtimeMs: Math.max(prev.mtimeMs ?? 0, mtimeMs),
      /** Limpar observação de fase na API; não importar fase dos txt 21.1/146.1 */
      limparAndamentoFase: inativo,
    });
  }

  for (const row of iterarFases21_1(baseRaizFase, opts)) {
    const key = `${row.cod8}|${row.numeroInterno}`;
    const existente = map.get(key);
    if (existente?.statusInativo) continue;
    if (ehFaseTxtInativo(row.texto)) continue;
    const { faseCanonica, aviso } = normalizarTextoFaseTxt(row.texto);
    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(row.arquivo).mtimeMs;
    } catch {
      /* ignore */
    }
    const entrada = {
      cod8: row.cod8,
      codNum: row.codNum,
      numeroInterno: row.numeroInterno,
      faseBruta: row.texto,
      faseCanonica,
      avisoFase: aviso,
      arquivoFase: row.arquivo,
      origemFase: row.origem,
      mtimeMs,
    };
    if (!existente) map.set(key, entrada);
    else if (preferirEntradaFase(entrada, existente)) map.set(key, { ...existente, ...entrada });
  }

  for (const row of iterarObservacoesFase146_1(baseGeraisMil, opts)) {
    const key = `${row.cod8}|${row.numeroInterno}`;
    const prevStatus = map.get(key);
    if (prevStatus?.statusInativo) continue;
    const observacao = normalizarObservacaoFaseTxt(row.texto);
    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(row.arquivo).mtimeMs;
    } catch {
      /* ignore */
    }
    const prev = map.get(key) ?? {
      cod8: row.cod8,
      codNum: row.codNum,
      numeroInterno: row.numeroInterno,
    };
    map.set(key, {
      ...prev,
      observacaoBruta: row.texto,
      observacaoFase: observacao,
      arquivoObservacao: row.arquivo,
      origemObs: row.origem,
      mtimeMs: Math.max(prev.mtimeMs ?? 0, mtimeMs),
    });
  }

  return [...map.values()].sort(
    (a, b) => a.codNum - b.codNum || a.numeroInterno - b.numeroInterno
  );
}

/**
 * @param {object[]} registos
 * @param {number} n
 * @param {number} [seed]
 */
export function amostraAleatoria(registos, n, seed = Date.now()) {
  if (registos.length <= n) return [...registos];
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const idx = registos.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).map((i) => registos[i]);
}
