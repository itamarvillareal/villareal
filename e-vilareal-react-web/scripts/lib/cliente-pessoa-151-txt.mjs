/**
 * Número de pessoa do cliente — txt legado VB `COD.151.1.0` (sem nº de processo).
 * Alimenta o campo «Pessoa» na tela de clientes (`pessoaId` na API).
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  centenaPastaClienteHistorico,
  formatCod8,
  pastaNumeroClienteHistorico,
  readOneLineFile,
  SEGMENTO_MIL,
} from './historico-local-txt-paths.mjs';
import { resolverBaseBancoDados } from './gerais-fase-processo-txt.mjs';
import { resolverPessoaIdCliente } from './vilareal-import-processo-api.mjs';

export const TIPO_PESSOA_CLIENTE = '151.1.0';

/**
 * @param {string} baseBanco
 * @param {number} codNum
 * @returns {string}
 */
export function caminhoArquivoPessoaCliente151(baseBanco, codNum) {
  const cod8 = formatCod8(codNum);
  const cent = centenaPastaClienteHistorico(codNum);
  const pastaCli = pastaNumeroClienteHistorico(codNum);
  return path.join(baseBanco, 'Gerais', SEGMENTO_MIL, String(cent), pastaCli, `${cod8}.${TIPO_PESSOA_CLIENTE}.txt`);
}

/**
 * @param {number} codNum
 * @param {{ baseBanco?: string }} [opts]
 * @returns {{ pessoaId: number | null, arquivo: string | null, textoBruto?: string | null, aviso?: string }}
 */
export function lerNumeroPessoaCliente151Txt(codNum, opts = {}) {
  const baseBanco = opts.baseBanco ?? resolverBaseBancoDados();
  const abs = caminhoArquivoPessoaCliente151(baseBanco, codNum);
  if (!fs.existsSync(abs)) {
    return { pessoaId: null, arquivo: null };
  }

  const textoBruto = readOneLineFile(abs);
  const t = String(textoBruto ?? '').trim();
  if (!t) {
    return { pessoaId: null, arquivo: abs, textoBruto: t, aviso: 'vazio' };
  }

  const n = Number.parseInt(t.replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1) {
    return { pessoaId: null, arquivo: abs, textoBruto: t, aviso: 'valor_invalido' };
  }

  return { pessoaId: n, arquivo: abs, textoBruto: t };
}

/**
 * Garante vínculo `codigoCliente` → `pessoaId` (POST idempotente).
 * Não altera se o código já estiver ligado a outra pessoa na API.
 *
 * @param {string} baseUrl
 * @param {string} token
 * @param {string} cod8
 * @param {number} pessoaIdTxt
 * @param {Map<string, number>} [cache]
 */
export async function sincronizarVinculoClientePessoaApi(
  baseUrl,
  token,
  cod8,
  pessoaIdTxt,
  cache = new Map()
) {
  const pid = Math.trunc(Number(pessoaIdTxt));
  if (!Number.isFinite(pid) || pid < 1) {
    return { acao: 'ignorado', motivo: 'pessoa_id_invalido' };
  }

  const atual = await resolverPessoaIdCliente(baseUrl, token, cod8, cache);
  if (atual === pid) {
    return { acao: 'ja_ok', pessoaId: pid };
  }
  if (atual != null && atual !== pid) {
    return {
      acao: 'divergente_api',
      pessoaIdApi: atual,
      pessoaIdTxt: pid,
      motivo: 'codigo_ja_vinculado_outra_pessoa',
    };
  }

  const res = await fetch(`${baseUrl}/api/clientes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({ codigoCliente: cod8, pessoaId: pid }),
  });
  const txt = await res.text();
  let body = null;
  try {
    body = txt ? JSON.parse(txt) : null;
  } catch {
    body = null;
  }

  if (res.status === 201 || res.status === 200) {
    cache.set(cod8, pid);
    return {
      acao: res.status === 201 ? 'criado' : 'confirmado',
      pessoaId: pid,
      cliente: body,
    };
  }

  if (res.status === 409 || res.status === 422) {
    return {
      acao: 'rejeitado',
      pessoaIdTxt: pid,
      status: res.status,
      detalhe: txt.slice(0, 300),
    };
  }

  throw new Error(`POST /api/clientes ${cod8}: ${res.status} ${txt.slice(0, 300)}`);
}
