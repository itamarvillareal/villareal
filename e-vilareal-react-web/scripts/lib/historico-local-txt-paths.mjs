/**
 * Caminhos e leitura de ficheiros txt do histórico local (Dropbox «Banco de Dados»).
 * Partilhado por `extrair-historico-local-txt-para-xls.mjs` e `verificar-historico-txt-vs-mysql.mjs`.
 *
 * Fluxo principal (alinhado ao legado VB):
 * 1. Índice **14** por processo (`…14.1.<proc>.txt`) → N; se vazio/ausente, infere-se N pelo maior `….16.1.<proc>.<IIII>.txt` na pasta.
 * 2. Para cada índice: **16** (data) — procura-se em `…/Ano/<aaaa>/<mm>/` ou legado `…/<aaaa>/<mm>/`;
 *    senão na árvore `1000/<centena>/<nº cliente>/`.
 *    Ao comparar ou exportar, **dd/mm** na linha usa o **ano e mês da pasta** quando o ficheiro vem dessas pastas.
 * 3. Informação **15** e utilizador **17**: mesmas pastas por ano/mês (com varredura se o mês da data não coincidir);
 *    senão fallback na árvore mil (HC e «Historico de Consultas Inativos»).
 * 4. Cliente **728**: ficheiros ficam sempre sob a pasta de centena **700** (não depende de outras centenas).
 */

import fs from 'node:fs';
import path from 'node:path';

export const PREFIXOS = ['HC', 'Historico de Consultas Inativos'];
export const SEGMENTO_MIL = '1000';
export const TIPO_INDICE = 14;
export const TIPO_INFO = 15;
export const TIPO_DATA = 16;
export const TIPO_USUARIO = 17;
export const MEIO_FIXO = 1;

export const DEFAULT_BASE_HISTORICO_LOCAL = '/Users/itamar/Dropbox/Banco de Dados';
export const MAX_CLIENTE_HISTORICO_LOCAL = 999;
export const MAX_PROC_PADRAO_HISTORICO_LOCAL = 999;
export const MAX_PROC_CLIENTE_728_HISTORICO_LOCAL = 1640;

/** Pastas mil: cliente 728 usa exclusivamente a centena 700. */
export const CENTENA_PASTA_CLIENTE_728 = 700;

/** @param {number} codNum — inteiro 1..999 */
export function centenaPorRegraVB(codNum) {
  const n = Math.floor(Number(codNum));
  if (!Number.isFinite(n) || n < 1) return 0;
  if (n < 100) return 0;
  if (n < 200) return 100;
  if (n < 300) return 200;
  if (n < 400) return 300;
  if (n < 500) return 400;
  if (n < 600) return 500;
  if (n < 700) return 600;
  if (n < 800) return 700;
  if (n < 900) return 800;
  if (n < 1000) return 900;
  return 900;
}

/**
 * Centena da pasta `1000/<cent>/` para localizar ficheiros do cliente.
 * O 728 fica sempre em **700**; os restantes seguem a regra VB (`centenaPorRegraVB`).
 * @param {number} codNum
 */
export function centenaPastaClienteHistorico(codNum) {
  const n = Math.trunc(Number(codNum));
  if (n === 728) return CENTENA_PASTA_CLIENTE_728;
  return centenaPorRegraVB(n);
}

export function formatCod8(codNum) {
  return String(Math.trunc(Number(codNum))).padStart(8, '0');
}

/**
 * Nome da pasta do cliente sob `1000/<centena>/` (ex.: 1 → "1", 728 → "728"), não o código com 8 dígitos.
 * @param {number} codNum
 */
export function pastaNumeroClienteHistorico(codNum) {
  return String(Math.trunc(Number(codNum)));
}

/** Mínimo 2 caracteres no nome do ficheiro; sem zeros extra quando ≥ 10. */
export function formatProcNomeArquivo(procNum) {
  const n = Math.trunc(Number(procNum));
  if (!Number.isFinite(n) || n < 1) return null;
  const s = String(n);
  if (s.length < 2) return s.padStart(2, '0');
  return s;
}

export function formatIndice4(n) {
  return String(Math.trunc(Number(n))).padStart(4, '0');
}

export function formatCentenaPasta(cent) {
  return String(Math.trunc(Number(cent))).padStart(3, '0');
}

/**
 * Decodifica buffer de ficheiro txt legado (UTF-8 ou ISO-8859-1 / Windows-1252).
 * @param {Buffer} buf
 * @returns {string}
 */
export function decodeHistoricoTextBuffer(buf) {
  if (!buf?.length) return '';
  let start = 0;
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) start = 3;
  const body = start > 0 ? buf.subarray(start) : buf;
  if (!body.length) return '';
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(body);
    return body.toString('utf8');
  } catch {
    return body.toString('latin1');
  }
}

/**
 * @param {string} p
 * @returns {string | null}
 */
export function readOneLineFile(p) {
  try {
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
    const buf = fs.readFileSync(p);
    const s = decodeHistoricoTextBuffer(buf);
    const line = s.split(/\r?\n/).find((l) => String(l).trim() !== '');
    return line != null ? String(line).trim() : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} base
 * @param {string[]} relPaths
 * @returns {{ texto: string | null, relAposRaiz: string | null }} `relAposRaiz` = caminho POSIX após a raiz «Banco de Dados»
 */
export function readFirstExistingComCaminho(base, relPaths) {
  for (const rel of relPaths) {
    const abs = path.join(base, rel);
    const t = readOneLineFile(abs);
    if (t != null) {
      const relNorm = rel.split(path.sep).join('/');
      return { texto: String(t).trim(), relAposRaiz: relNorm };
    }
  }
  return { texto: null, relAposRaiz: null };
}

export function readFirstExisting(base, relPaths) {
  return readFirstExistingComCaminho(base, relPaths).texto;
}

export function nomeArquivo(cod8, tipo, procStr, indice4) {
  return `${cod8}.${tipo}.${MEIO_FIXO}.${procStr}.${indice4}.txt`;
}

/**
 * Ficheiro de **máximo índice** por processo (tipo 14): uma linha com N; não usa sufixo `0001`.
 * Ex.: `00000728.14.1.01.txt`
 */
export function nomeArquivoIndice14PorProcesso(cod8, procStr) {
  return `${cod8}.${TIPO_INDICE}.${MEIO_FIXO}.${procStr}.txt`;
}

/** Caminhos relativos (prefixos HC / Inativos) até ao ficheiro do índice 14 do processo. */
export function relPathsIndice14PorProcesso(base, cod8, codNum, procStr) {
  const cent = formatCentenaPasta(centenaPastaClienteHistorico(codNum));
  const pastaCliente = pastaNumeroClienteHistorico(codNum);
  const dir = path.join(SEGMENTO_MIL, cent, pastaCliente);
  const file = nomeArquivoIndice14PorProcesso(cod8, procStr);
  return PREFIXOS.map((pre) => path.join(pre, dir, file));
}

export function relPathsIndiceOuDataTipo(base, cod8, codNum, procStr, tipo, indice4) {
  const cent = formatCentenaPasta(centenaPastaClienteHistorico(codNum));
  const pastaCliente = pastaNumeroClienteHistorico(codNum);
  const dir = path.join(SEGMENTO_MIL, cent, pastaCliente);
  const file = nomeArquivo(cod8, tipo, procStr, indice4);
  return PREFIXOS.map((pre) => path.join(pre, dir, file));
}

/** Caminhos `Ano/aaaa/mm` e legado `aaaa/mm` (VB antigo) sob HC / Inativos. */
export function relPathsDataPorAnoMes(cod8, procStr, yyyy, mm, tipo, indice4) {
  const file = nomeArquivo(cod8, tipo, procStr, indice4);
  const y = String(yyyy);
  const mm2 = String(mm).padStart(2, '0');
  /** @type {string[]} */
  const out = [];
  for (const pre of PREFIXOS) {
    out.push(path.join(pre, 'Ano', y, mm2, file));
    out.push(path.join(pre, y, mm2, file));
  }
  return out;
}

/** @deprecated Use `relPathsDataPorAnoMes`. */
export function relPathsAno(cod8, procStr, yyyy, mm, tipo, indice4) {
  return relPathsDataPorAnoMes(cod8, procStr, yyyy, mm, tipo, indice4);
}

/**
 * Percorre pastas de data sob um prefixo: `Ano/aaaa/mm` e também `aaaa/mm` (sem «Ano»).
 * @param {string} preAbs
 * @yields {{ yyyy: number, mm: number, dirAbs: string }}
 */
export function* iterPastasAnoMesSobPrefixo(preAbs) {
  if (!fs.existsSync(preAbs)) return;
  const anoRoot = path.join(preAbs, 'Ano');
  if (fs.existsSync(anoRoot) && fs.statSync(anoRoot).isDirectory()) {
    yield* iterPastasYyyyMmDiretorio(anoRoot);
  }
  let top;
  try {
    top = fs.readdirSync(preAbs);
  } catch {
    return;
  }
  for (const y of top) {
    if (!/^\d{4}$/.test(y)) continue;
    const yPath = path.join(preAbs, y);
    try {
      if (!fs.statSync(yPath).isDirectory()) continue;
    } catch {
      continue;
    }
    let months;
    try {
      months = fs.readdirSync(yPath).filter((m) => /^\d{2}$/.test(m));
    } catch {
      continue;
    }
    for (const mo of months) {
      const dirAbs = path.join(yPath, mo);
      try {
        if (fs.statSync(dirAbs).isDirectory()) {
          yield {
            yyyy: Number.parseInt(y, 10),
            mm: Number.parseInt(mo, 10),
            dirAbs,
          };
        }
      } catch {
        /* skip */
      }
    }
  }
}

/**
 * @param {string} yyyyRoot
 * @yields {{ yyyy: number, mm: number, dirAbs: string }}
 */
function* iterPastasYyyyMmDiretorio(yyyyRoot) {
  let years;
  try {
    years = fs.readdirSync(yyyyRoot).filter((y) => /^\d{4}$/.test(y));
  } catch {
    return;
  }
  years.sort((a, b) => Number(a) - Number(b));
  for (const y of years) {
    const yPath = path.join(yyyyRoot, y);
    try {
      if (!fs.statSync(yPath).isDirectory()) continue;
    } catch {
      continue;
    }
    let months;
    try {
      months = fs.readdirSync(yPath).filter((m) => /^\d{2}$/.test(m));
    } catch {
      continue;
    }
    months.sort((a, b) => Number(a) - Number(b));
    for (const mo of months) {
      const dirAbs = path.join(yPath, mo);
      try {
        if (fs.statSync(dirAbs).isDirectory()) {
          yield {
            yyyy: Number.parseInt(y, 10),
            mm: Number.parseInt(mo, 10),
            dirAbs,
          };
        }
      } catch {
        /* skip */
      }
    }
  }
}

/**
 * Interpreta `d/m/aaaa` ou `m/d/aaaa` (legado VB/Excel nos txt).
 * @param {number | null} [mmPastaHint] mês da pasta `Ano/aaaa/mm` para datas ambíguas
 * @returns {{ dd: number, mo: number, yyyy: number } | null}
 */
export function parseDataSlashComHint(s, mmPastaHint = null) {
  if (s == null || String(s).trim() === '') return null;
  const t = String(s).trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(yyyy)) return null;

  let dd;
  let mo;
  if (a > 12 && b <= 12) {
    dd = a;
    mo = b;
  } else if (b > 12 && a <= 12) {
    mo = a;
    dd = b;
  } else if (a > 12 && b > 12) {
    return null;
  } else if (mmPastaHint != null && mmPastaHint >= 1 && mmPastaHint <= 12) {
    if (b === mmPastaHint) {
      dd = a;
      mo = b;
    } else if (a === mmPastaHint) {
      mo = a;
      dd = b;
    } else {
      dd = a;
      mo = b;
    }
  } else {
    dd = a;
    mo = b;
  }
  if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return null;
  const dim = new Date(yyyy, mo, 0).getDate();
  if (dd > dim) return null;
  return { dd, mo, yyyy };
}

export function parseDataDdMmYyyy(s, mmPastaHint = null) {
  const p = parseDataSlashComHint(s, mmPastaHint);
  if (!p) return null;
  return { ...p, original: String(s).trim() };
}

/**
 * Extrai ano e mês (e dia) a partir do texto da data, para montar `Ano/<aaaa>/<mm>/`.
 * Aceita dd/mm/aaaa, prefixo ISO yyyy-mm-dd e serial Excel (número).
 * @param {string | null | undefined} s
 * @returns {{ yyyy: number, mo: number, dd: number } | null}
 */
export function extrairYmdParaPastasAno(s) {
  if (s == null || String(s).trim() === '') return null;
  const br = parseDataDdMmYyyy(s);
  if (br) return { yyyy: br.yyyy, mo: br.mo, dd: br.dd };
  const t = String(s).trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const yyyy = Number(iso[1]);
    const mo = Number(iso[2]);
    const dd = Number(iso[3]);
    if (Number.isFinite(yyyy) && mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31) return { yyyy, mo, dd };
  }
  const n = Number(t.replace(',', '.'));
  if (Number.isFinite(n)) {
    const whole = Math.floor(n);
    if (whole > 20000 && whole < 600000) {
      const utcMs = (whole - 25569) * 86400 * 1000;
      const d = new Date(utcMs);
      if (!Number.isNaN(d.getTime())) {
        return { yyyy: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, dd: d.getUTCDate() };
      }
    }
  }
  return null;
}

function pad2internal(n) {
  return String(Math.trunc(Number(n))).padStart(2, '0');
}

/** @type {Map<string, { texto: string, yyyy: number, mm: number, relAposRaiz: string } | null>} */
const _cacheFicheiroArvoreData = new Map();

export function limparCacheLeituraHistoricoLocal() {
  _cacheFicheiroArvoreData.clear();
}

/**
 * Localiza ficheiro de histórico sob `Ano/aaaa/mm` ou `aaaa/mm` (legado).
 * @returns {{ texto: string, yyyy: number, mm: number, relAposRaiz: string } | null}
 */
/**
 * @param {string} preAbs
 * @param {number | null} yyyyFiltro
 * @yields {{ yyyy: number, mm: number, dirAbs: string }}
 */
function* iterPastasAnoMesSobPrefixoFiltrado(preAbs, yyyyFiltro) {
  if (yyyyFiltro != null && Number.isFinite(yyyyFiltro)) {
    const y = String(yyyyFiltro);
    for (const root of [path.join(preAbs, 'Ano', y), path.join(preAbs, y)]) {
      if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) continue;
      let months;
      try {
        months = fs.readdirSync(root).filter((m) => /^\d{2}$/.test(m));
      } catch {
        continue;
      }
      for (const mo of months) {
        const dirAbs = path.join(root, mo);
        try {
          if (fs.statSync(dirAbs).isDirectory()) {
            yield { yyyy: yyyyFiltro, mm: Number.parseInt(mo, 10), dirAbs };
          }
        } catch {
          /* skip */
        }
      }
    }
    return;
  }
  yield* iterPastasAnoMesSobPrefixo(preAbs);
}

export function procurarFicheiroHistoricoEmArvoreData(base, cod8, procStr, tipo, indice4, yyyyFiltro = null) {
  const nome = nomeArquivo(cod8, tipo, procStr, indice4);
  const cacheKey = `${tipo}|${cod8}|${procStr}|${indice4}|${yyyyFiltro ?? 'all'}`;
  if (_cacheFicheiroArvoreData.has(cacheKey)) return _cacheFicheiroArvoreData.get(cacheKey);

  let found = null;
  for (const pre of PREFIXOS) {
    for (const { yyyy, mm, dirAbs } of iterPastasAnoMesSobPrefixoFiltrado(
      path.join(base, pre),
      yyyyFiltro
    )) {
      const abs = path.join(dirAbs, nome);
      const t = readOneLineFile(abs);
      if (t != null && String(t).trim() !== '') {
        found = {
          texto: String(t).trim(),
          yyyy,
          mm,
          relAposRaiz: path.relative(base, abs).split(path.sep).join('/'),
        };
        break;
      }
    }
    if (found) break;
  }
  _cacheFicheiroArvoreData.set(cacheKey, found);
  return found;
}

/**
 * Localiza `COD.16.1.<proc>.<IIII>.txt` nas pastas por ano/mês.
 * @returns {{ texto: string, yyyy: number, mm: number, relAposRaiz: string } | null}
 */
export function procurarTipo16EmPastasAno(base, cod8, procStr, indice4) {
  return procurarFicheiroHistoricoEmArvoreData(base, cod8, procStr, TIPO_DATA, indice4);
}

/**
 * Lê texto de tipo 15/17: pastas ano/mês (dica ou varredura), depois mil.
 * @param {{ yyyy?: number, mm?: number } | null} [pastaAnoMes]
 */
export function lerTextoTipoHistoricoEncadeado(
  base,
  cod8,
  codNum,
  procStr,
  tipo,
  indice4,
  pastaAnoMes
) {
  if (pastaAnoMes?.yyyy != null && pastaAnoMes?.mm != null) {
    const hit = readFirstExisting(
      base,
      relPathsDataPorAnoMes(cod8, procStr, pastaAnoMes.yyyy, pastaAnoMes.mm, tipo, indice4)
    );
    if (hit != null && String(hit).trim() !== '') return String(hit).trim();
  }
  const yyyyBusca = pastaAnoMes?.yyyy ?? null;
  let emArvore = procurarFicheiroHistoricoEmArvoreData(base, cod8, procStr, tipo, indice4, yyyyBusca);
  if (!emArvore?.texto && yyyyBusca != null) {
    emArvore = procurarFicheiroHistoricoEmArvoreData(base, cod8, procStr, tipo, indice4, null);
  }
  if (emArvore?.texto) return emArvore.texto;
  const mil = readFirstExisting(
    base,
    relPathsIndiceOuDataTipo(base, cod8, codNum, procStr, tipo, indice4)
  );
  return mil != null && String(mil).trim() !== '' ? String(mil).trim() : null;
}

/**
 * Lê tipo **16** com meta de pasta: prioriza `Ano/aaaa/mm`; senão mil + tentativa Ano a partir do conteúdo.
 * @returns {{ texto: string | null, yyyyPasta: number | null, mmPasta: number | null, localAposBancoDeDados: string | null }}
 */
export function lerTipo16PrincipalComMeta(base, cod8, codNum, procStr, indice4) {
  const emAno = procurarTipo16EmPastasAno(base, cod8, procStr, indice4);
  if (emAno) {
    return {
      texto: emAno.texto,
      yyyyPasta: emAno.yyyy,
      mmPasta: emAno.mm,
      localAposBancoDeDados: emAno.relAposRaiz,
    };
  }

  const relsMil = relPathsIndiceOuDataTipo(base, cod8, codNum, procStr, TIPO_DATA, indice4);
  const milHit = readFirstExistingComCaminho(base, relsMil);
  if (milHit.texto == null || String(milHit.texto).trim() === '') {
    return { texto: null, yyyyPasta: null, mmPasta: null, localAposBancoDeDados: null };
  }

  const ymd = extrairYmdParaPastasAno(milHit.texto);
  if (ymd) {
    const mm = String(ymd.mo).padStart(2, '0');
    const anoHit = readFirstExistingComCaminho(
      base,
      relPathsDataPorAnoMes(cod8, procStr, ymd.yyyy, ymd.mo, TIPO_DATA, indice4)
    );
    if (anoHit.texto != null && String(anoHit.texto).trim() !== '') {
      return {
        texto: String(anoHit.texto).trim(),
        yyyyPasta: ymd.yyyy,
        mmPasta: ymd.mo,
        localAposBancoDeDados: anoHit.relAposRaiz,
      };
    }
  }
  return {
    texto: String(milHit.texto).trim(),
    yyyyPasta: null,
    mmPasta: null,
    localAposBancoDeDados: milHit.relAposRaiz,
  };
}

/**
 * Data canónica `yyyy-mm-dd`: com pasta `Ano`, interpreta **dd/mm** na linha com **ano e mês da pasta**;
 * senão usa `extrairYmdParaPastasAno` na linha.
 */
export function ymdComLinhaEPastaAno(linha, yyyyPasta, mmPasta) {
  if (linha == null || String(linha).trim() === '') return null;
  if (
    yyyyPasta != null &&
    mmPasta != null &&
    Number.isFinite(yyyyPasta) &&
    Number.isFinite(mmPasta) &&
    mmPasta >= 1 &&
    mmPasta <= 12
  ) {
    const br = parseDataDdMmYyyy(linha, mmPasta);
    if (br && br.dd >= 1 && br.dd <= 31) {
      const dim = new Date(yyyyPasta, mmPasta, 0).getDate();
      if (br.dd <= dim) return `${yyyyPasta}-${pad2internal(mmPasta)}-${pad2internal(br.dd)}`;
    }
    const flex = extrairYmdParaPastasAno(linha);
    if (flex && flex.yyyy === yyyyPasta && flex.mo === mmPasta) {
      return `${flex.yyyy}-${pad2internal(flex.mo)}-${pad2internal(flex.dd)}`;
    }
  }
  const flex = extrairYmdParaPastasAno(linha);
  if (!flex) return null;
  return `${flex.yyyy}-${pad2internal(flex.mo)}-${pad2internal(flex.dd)}`;
}

/**
 * @deprecated Preferir `lerTipo16PrincipalComMeta`; mantido para chamadas que só precisam do texto.
 */
export function lerTextoTipoDataEncadeado(base, cod8, codNum, procStr, indice4) {
  const m = lerTipo16PrincipalComMeta(base, cod8, codNum, procStr, indice4);
  return m.texto;
}

export function parseIntStrict(s) {
  const n = Number.parseInt(String(s).trim(), 10);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Quando o tipo **14** está vazio ou ilegível, infere N pelo maior sufixo numérico dos ficheiros
 * `COD.16.1.<proc>.<IIII>.txt` na pasta do cliente (HC / Inativos).
 */
export function inferirMaxIndicePorFicheirosTipo16(base, cod8, codNum, procStr) {
  const cent = formatCentenaPasta(centenaPastaClienteHistorico(codNum));
  const pastaCliente = pastaNumeroClienteHistorico(codNum);
  const relDir = path.join(SEGMENTO_MIL, cent, pastaCliente);
  const prefix = `${cod8}.${TIPO_DATA}.${MEIO_FIXO}.${procStr}.`;
  let max = 0;
  for (const pre of PREFIXOS) {
    const dirAbs = path.join(base, pre, relDir);
    if (!fs.existsSync(dirAbs) || !fs.statSync(dirAbs).isDirectory()) continue;
    let ents;
    try {
      ents = fs.readdirSync(dirAbs);
    } catch {
      continue;
    }
    for (const f of ents) {
      if (!f.startsWith(prefix) || !f.endsWith('.txt')) continue;
      const rest = f.slice(prefix.length, -4);
      const n = parseIntStrict(rest);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max > 0 ? max : null;
}

/** Lê N do ficheiro tipo 14 por processo; se inválido, infere pelos ficheiros tipo 16. */
export function lerMaxIndiceHistorico(base, cod8, codNum, procStr) {
  const rels = relPathsIndice14PorProcesso(base, cod8, codNum, procStr);
  const content = readFirstExisting(base, rels);
  if (content != null) {
    const n = parseIntStrict(content);
    if (Number.isFinite(n) && n >= 1) return Math.trunc(n);
  }
  return inferirMaxIndicePorFicheirosTipo16(base, cod8, codNum, procStr);
}

export function carregarContagensOpcional(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!j || typeof j !== 'object') return null;
    /** @type {Map<number, number>} */
    const m = new Map();
    for (const [k, v] of Object.entries(j)) {
      const cod = Number.parseInt(String(k).replace(/\D/g, ''), 10);
      const mx = Number.parseInt(String(v), 10);
      if (
        Number.isFinite(cod) &&
        cod >= 1 &&
        cod <= MAX_CLIENTE_HISTORICO_LOCAL &&
        Number.isFinite(mx) &&
        mx >= 1
      ) {
        m.set(cod, Math.min(Math.max(mx, 1), 50000));
      }
    }
    return m.size ? m : null;
  } catch (e) {
    console.warn('[contagens] Ficheiro inválido — ignoro:', e?.message || e);
    return null;
  }
}

export function maxProcParaCliente(codNum, contagensMap) {
  if (contagensMap?.has(codNum)) return contagensMap.get(codNum);
  if (codNum === 728) return MAX_PROC_CLIENTE_728_HISTORICO_LOCAL;
  return MAX_PROC_PADRAO_HISTORICO_LOCAL;
}
