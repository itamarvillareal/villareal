/**
 * Leitura de índices mensais em «Banco de Dados/Índices» (Formulario = "Índices" no VBA).
 * Nome: `{indice}.jan.2020.txt` ← LCase(Indice & "." & Format(data, "mmm/yyyy") com "/" → ".")
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolverBaseBancoDados } from './gerais-fase-processo-txt.mjs';

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const cachePorBase = new Map();

/**
 * Contador linear do VBA: (((ano - 1990) * 12) + 4) + mes (1-12).
 * @param {number} ano
 * @param {number} mes 1-12
 */
export function vbaMesContador(ano, mes) {
  return (ano - 1990) * 12 + 4 + mes;
}

/** @param {number} contador */
export function contadorParaData(competenciaContador) {
  const offsetMes = competenciaContador - 5;
  return new Date(1990, offsetMes, 1);
}

/**
 * @param {Date} d
 * @returns {string} ex.: inpc.jan.2020
 */
export function nomeArquivoIndiceMensal(indice, d) {
  const nome = String(indice ?? 'INPC').trim().toLowerCase();
  const mes = MESES_ABREV[d.getMonth()] ?? 'jan';
  const ano = d.getFullYear();
  return `${nome}.${mes}.${ano}`;
}

/**
 * @param {string} filePath
 */
function lerValorIndiceTxt(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const raw = fs.readFileSync(filePath, 'utf8').trim().replace(/\u00a0/g, ' ');
  if (!raw) return 0;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {string} indice INPC, IGPM, …
 * @param {Date} dataIni
 * @param {Date} dataFim
 * @param {{ baseBanco?: string }} [opts]
 * @returns {(competenciaContador: number) => number}
 */
export function criarLeitorIndiceMensal(indice, dataIni, dataFim, opts = {}) {
  const base = opts.baseBanco?.trim() || resolverBaseBancoDados();
  const dirIndices = path.join(base, 'Índices');
  const cacheKey = `${dirIndices}|${String(indice).toLowerCase()}`;
  if (!cachePorBase.has(cacheKey)) cachePorBase.set(cacheKey, new Map());
  const cache = cachePorBase.get(cacheKey);

  const a = vbaMesContador(dataIni.getFullYear(), dataIni.getMonth() + 1);
  const b = vbaMesContador(dataFim.getFullYear(), dataFim.getMonth() + 1);

  return (i) => {
    if (i < a || i > b) return 0;
    if (cache.has(i)) return cache.get(i);
    const d = contadorParaData(i);
    const arquivo = nomeArquivoIndiceMensal(indice, d);
    const full = path.join(dirIndices, `${arquivo}.txt`);
    const v = lerValorIndiceTxt(full);
    cache.set(i, v);
    return v;
  };
}
