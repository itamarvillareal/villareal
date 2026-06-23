/**
 * Varredura rápida de Calculos/*.txt (só nomes de ficheiro + leitura pontual do 105 aceite).
 */

import fs from 'node:fs';
import path from 'node:path';

import { resolverBaseBancoDados } from './gerais-fase-processo-txt.mjs';
import { readOneLineFile } from './historico-local-txt-paths.mjs';
import {
  PASTA_CALCULOS,
  TIPOS_CALCULO,
  chaveRodadaCalculo,
  dirCalculosCliente,
  parseNomeArquivoCalculo,
} from './calculos-dropbox-txt.mjs';

const TIPOS_SNAPSHOT_PROCESSO = new Set([
  TIPOS_CALCULO.TOTAL_TAXAS,
  TIPOS_CALCULO.TOTAL_CUSTAS,
  TIPOS_CALCULO.TOTAL_A_PAGAR,
  TIPOS_CALCULO.VALOR_FINAL_PARCELA,
]);

/**
 * @param {string} [baseBanco]
 * @returns {number[]}
 */
export function listarCodigosClientesComPastaCalculos(baseBanco) {
  const root = path.join(baseBanco?.trim() || resolverBaseBancoDados(), PASTA_CALCULOS);
  if (!fs.existsSync(root)) return [];
  const out = new Set();
  for (const mil of fs.readdirSync(root, { withFileTypes: true })) {
    if (!mil.isDirectory()) continue;
    const pMil = path.join(root, mil.name);
    for (const cent of fs.readdirSync(pMil, { withFileTypes: true })) {
      if (!cent.isDirectory()) continue;
      const pCent = path.join(pMil, cent.name);
      for (const cli of fs.readdirSync(pCent, { withFileTypes: true })) {
        if (!cli.isDirectory()) continue;
        const n = Number(cli.name);
        if (Number.isFinite(n) && n >= 1) out.add(n);
      }
    }
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * @param {number} codNum
 * @param {string} [baseBanco]
 * @returns {Map<string, {
 *   cod8: string,
 *   numeroProcesso: number,
 *   dimensao: number,
 *   esperadoDebitos: number,
 *   txtAceito: boolean,
 *   txtSnapshot: boolean,
 * }>}
 */
export function scanExpectativasCalculosTxtCliente(codNum, baseBanco) {
  const dir = dirCalculosCliente(codNum, baseBanco);
  /** @type {Map<string, { venc: Set<number>, val: Set<number>, aceito: boolean, snapshot: boolean, meta: { cod8: string, numeroProcesso: number, dimensao: number } }>} */
  const acc = new Map();
  if (!fs.existsSync(dir)) return new Map();

  for (const f of fs.readdirSync(dir)) {
    if (!f.toLowerCase().endsWith('.txt')) continue;
    const meta = parseNomeArquivoCalculo(f);
    if (!meta || meta.codNum !== codNum || meta.numeroProcesso == null) continue;

    const key = chaveRodadaCalculo(codNum, meta.numeroProcesso, meta.dimensao);
    if (!acc.has(key)) {
      acc.set(key, {
        venc: new Set(),
        val: new Set(),
        aceito: false,
        snapshot: false,
        meta: {
          cod8: meta.cod8,
          numeroProcesso: meta.numeroProcesso,
          dimensao: meta.dimensao,
        },
      });
    }
    const b = acc.get(key);

    if (meta.tipo === TIPOS_CALCULO.VENCIMENTO_TAXA && meta.linha != null) b.venc.add(meta.linha);
    if (meta.tipo === TIPOS_CALCULO.VALOR_TITULO && meta.linha != null) b.val.add(meta.linha);
    if (meta.tipo === TIPOS_CALCULO.JUROS_TAXA && meta.linha != null) b.snapshot = true;
    if (TIPOS_SNAPSHOT_PROCESSO.has(meta.tipo) && meta.linha == null) b.snapshot = true;

    if (meta.tipo === TIPOS_CALCULO.CALCULO_ACEITO && meta.linha == null) {
      try {
        const v = readOneLineFile(path.join(dir, f)).trim().toUpperCase();
        if (v === 'SIM') {
          b.aceito = true;
          b.snapshot = true;
        }
      } catch {
        /* ignore */
      }
    }
  }

  /** @type {Map<string, ReturnType<typeof scanExpectativasCalculosTxtCliente> extends Map<string, infer V> ? V : never>} */
  const out = new Map();
  for (const [key, b] of acc) {
    const linhas = new Set([...b.venc, ...b.val]);
    const esperadoDebitos = linhas.size;
    if (esperadoDebitos <= 0 && !b.aceito && !b.snapshot) continue;
    const txtSnapshot = b.snapshot || b.aceito;
    const esperadoGravados = txtSnapshot && esperadoDebitos > 0 ? esperadoDebitos : 0;
    out.set(key, {
      cod8: b.meta.cod8,
      numeroProcesso: b.meta.numeroProcesso,
      dimensao: b.meta.dimensao,
      esperadoDebitos,
      esperadoTitulos: esperadoDebitos,
      esperadoGravados,
      txtAceito: b.aceito,
      txtSnapshot,
    });
  }
  return out;
}

/**
 * @param {string} [baseBanco]
 * @returns {Map<string, import('./calculos-txt-scan-rapido.mjs').scanExpectativasCalculosTxtCliente extends (...args: any) => Map<string, infer V> ? V : never>}
 */
export function scanExpectativasCalculosTxtTodosClientes(baseBanco) {
  const base = baseBanco?.trim() || resolverBaseBancoDados();
  const out = new Map();
  for (const cod of listarCodigosClientesComPastaCalculos(base)) {
    for (const [key, row] of scanExpectativasCalculosTxtCliente(cod, base)) {
      out.set(key, row);
    }
  }
  return out;
}

/**
 * @param {ReturnType<typeof scanExpectativasCalculosTxtTodosClientes> extends Map<string, infer E> ? E : never} esperado
 * @param {{ exists: boolean, id?: number|null, titulos?: number, debitos?: number, gravados?: number, aceito?: boolean|null } | null | undefined} db
 */
export function diagnosticarRodadaTxtVsDb(esperado, db) {
  /** @type {string[]} */
  const motivos = [];
  const expDeb = esperado.esperadoDebitos;
  const expTit = esperado.esperadoTitulos;
  const expGrav = esperado.esperadoGravados;

  if (expDeb <= 0) {
    return { motivos, precisaAtualizacao: false };
  }

  if (!db?.exists) {
    motivos.push('AUSENTE_NO_BANCO');
    return { motivos, precisaAtualizacao: true };
  }

  const dbTit = Number(db.titulos) || 0;
  const dbDeb = Number(db.debitos) || 0;
  const dbGrav = Number(db.gravados) || 0;

  if (dbDeb !== expDeb) motivos.push('DEBITOS_QTD');
  if (dbTit !== expTit) motivos.push('TITULOS_QTD');
  if (expGrav > 0 && dbGrav === 0) motivos.push('GRAVADOS_AUSENTE');
  if (expGrav > 0 && dbGrav > 0 && dbGrav !== expGrav) motivos.push('GRAVADOS_QTD');
  if (dbTit !== dbDeb) motivos.push('TITULOS_DEBITOS_DESALINHADOS');

  return { motivos, precisaAtualizacao: motivos.length > 0 };
}

/** @param {string} cod8 @param {number} proc */
export function chaveParCodigoProcesso(cod8, proc) {
  return `${String(cod8).padStart(8, '0')}:${proc}`;
}
