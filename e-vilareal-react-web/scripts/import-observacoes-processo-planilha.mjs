#!/usr/bin/env node
/**
 * Importa «Observação do Processo» (campo `processo.observacao`) a partir de planilha Excel.
 * Usa apenas a coluna E; ignora as demais para o texto.
 * Código cliente: coluna D | Nº interno do processo: coluna N.
 *
 * Uso:
 *   VILAREAL_IMPORT_SENHA=123456 node scripts/import-observacoes-processo-planilha.mjs "/caminho/import obs.xlsx"
 *   node scripts/import-observacoes-processo-planilha.mjs "ficheiro.xlsx" --dry-run
 *   node scripts/import-observacoes-processo-planilha.mjs "ficheiro.xlsx" --cliente=922 --apenas-vazios
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA, VILAREAL_IMPORT_CONCURRENCY (default 5)
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

import { normalizarTextoPlanilha } from './lib/normalizar-texto-planilha.mjs';
import { clientePkFromApiDto } from './lib/vilareal-import-processo-api.mjs';

const COL_CLIENTE = 3; // D
const COL_OBS = 4; // E
const COL_PROC = 13; // N

function parseArgs(argv) {
  const out = {
    file: null,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: false,
    concurrency: Math.min(16, Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 5) || 5)),
    codigoClienteRaw: '',
    numeroInternoFiltro: null,
    apenasVazios: false,
    sheetName: null,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--apenas-vazios') out.apenasVazios = true;
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--cliente=')) out.codigoClienteRaw = a.slice(10).trim();
    else if (a.startsWith('--processo=')) {
      const n = Number(a.slice('--processo='.length).trim());
      if (Number.isFinite(n) && n >= 1) out.numeroInternoFiltro = Math.floor(n);
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(16, Math.floor(n));
    } else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--sheet=')) out.sheetName = a.slice(8).trim();
    else if (!a.startsWith('-') && !out.file) out.file = a;
  }
  return out;
}

function normalizarCodigoCliente8(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim().replace(/\D/g, '');
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return String(n).padStart(8, '0');
}

function parseNumeroInterno(val) {
  const bStr = val == null || val === '' ? '' : String(val).trim();
  let ni = Number.parseInt(bStr, 10);
  if (!Number.isFinite(ni) || ni < 1) ni = 1;
  return ni;
}

/**
 * @param {unknown[][]} mat
 * @returns {Map<string, { codigoCliente8: string; numeroInterno: number; observacao: string; linhaExcel: number }>}
 */
function extrairLinhasObservacao(mat) {
  /** @type {Map<string, { codigoCliente8: string; numeroInterno: number; observacao: string; linhaExcel: number }>} */
  const porChave = new Map();
  for (let i = 1; i < mat.length; i += 1) {
    const row = mat[i];
    if (!Array.isArray(row)) continue;
    const obsRaw = row[COL_OBS];
    const obs = normalizarTextoPlanilha(obsRaw);
    if (!obs) continue;
    const cod8 = normalizarCodigoCliente8(row[COL_CLIENTE]);
    if (!cod8) continue;
    const numeroInterno = parseNumeroInterno(row[COL_PROC]);
    const chave = `${cod8}:${numeroInterno}`;
    porChave.set(chave, {
      codigoCliente8: cod8,
      numeroInterno,
      observacao: obs,
      linhaExcel: i + 1,
    });
  }
  return porChave;
}

async function login(opts) {
  const res = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: String(opts.login).trim().toLowerCase(), senha: opts.senha }),
  });
  if (!res.ok) throw new Error(`Login falhou ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const j = await res.json();
  if (!j.accessToken) throw new Error('Login sem accessToken');
  return j.accessToken;
}

function extrairProcessoUnico(body, numeroInternoAlvo) {
  const ni = Math.floor(Number(numeroInternoAlvo));
  if (body == null) return null;
  if (Array.isArray(body)) return body.find((p) => Number(p?.numeroInterno) === ni) ?? null;
  if (typeof body === 'object' && Array.isArray(body.content)) {
    return body.content.find((p) => Number(p?.numeroInterno) === ni) ?? null;
  }
  if (typeof body === 'object' && body.id != null) {
    const niResp = Number(body.numeroInterno);
    return !Number.isFinite(niResp) || niResp === ni ? body : null;
  }
  return null;
}

async function buscarProcesso(token, baseUrl, codigoCliente8, numeroInterno) {
  const params = new URLSearchParams({
    codigoCliente: codigoCliente8,
    numeroInterno: String(numeroInterno),
  });
  const res = await fetch(`${baseUrl}/api/processos?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET processo ${codigoCliente8}/${numeroInterno}: ${res.status}`);
  const body = await res.json();
  return extrairProcessoUnico(body, numeroInterno);
}

/** @param {Record<string, unknown>} r @param {string} observacao */
function processoParaPut(r, observacao) {
  return {
    clienteId: clientePkFromApiDto(r) ?? r.clienteId,
    numeroInterno: r.numeroInterno,
    unidade: r.unidade ?? null,
    pasta: r.pasta ?? null,
    numeroCnj: r.numeroCnj ?? null,
    numeroProcessoAntigo: r.numeroProcessoAntigo ?? null,
    naturezaAcao: r.naturezaAcao ?? null,
    descricaoAcao: r.descricaoAcao ?? null,
    competencia: r.competencia ?? null,
    fase: r.fase ?? null,
    observacaoFase: r.observacaoFase ?? null,
    tramitacao: r.tramitacao ?? null,
    dataProtocolo: r.dataProtocolo ?? null,
    prazoFatal: r.prazoFatal ?? null,
    proximaConsulta: r.proximaConsulta ?? null,
    observacao: observacao.trim() || null,
    valorCausa: r.valorCausa ?? null,
    uf: r.uf ?? null,
    cidade: r.cidade ?? null,
    consultaAutomatica: r.consultaAutomatica === true,
    ativo: r.ativo !== false,
    consultor: r.consultor ?? null,
    usuarioResponsavelId: r.usuarioResponsavelId ?? null,
  };
}

async function putProcesso(token, baseUrl, processoId, body) {
  const res = await fetch(`${baseUrl}/api/processos/${processoId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, status: res.status, text: t };
  }
  return { ok: true };
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<void>} fn
 */
async function runPool(items, concurrency, fn) {
  const conc = Math.min(Math.max(1, Math.floor(concurrency)), items.length || 1);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: conc }, () => worker()));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const filePath = opts.file || path.resolve('import obs.xlsx');
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error('Ficheiro não encontrado:', abs);
    process.exit(1);
  }

  const wb = XLSX.readFile(abs, { cellDates: true });
  const sheetName = opts.sheetName || wb.SheetNames[0];
  const sh = wb.Sheets[sheetName];
  if (!sh) {
    console.error(`Aba "${sheetName}" não encontrada.`);
    process.exit(1);
  }

  const mat = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true });
  let linhas = [...extrairLinhasObservacao(mat).values()];

  if (opts.codigoClienteRaw) {
    const codF = normalizarCodigoCliente8(opts.codigoClienteRaw);
    if (!codF) {
      console.error('Código cliente inválido:', opts.codigoClienteRaw);
      process.exit(1);
    }
    linhas = linhas.filter((L) => L.codigoCliente8 === codF);
    console.log(`[filtro] cliente ${codF}: ${linhas.length} processo(s) únicos`);
  }
  if (opts.numeroInternoFiltro != null) {
    linhas = linhas.filter((L) => L.numeroInterno === opts.numeroInternoFiltro);
    console.log(`[filtro] processo ${opts.numeroInternoFiltro}: ${linhas.length} linha(s)`);
  }

  console.log(`[planilha] ${abs}`);
  console.log(`[planilha] Aba: ${sheetName}`);
  console.log(`[planilha] Processos únicos com observação (col. E): ${linhas.length}`);
  console.log(`[modo] ${opts.dryRun ? 'DRY-RUN' : 'EXECUÇÃO'} | apenas-vazios=${opts.apenasVazios}`);

  if (linhas.length === 0) {
    console.log('Nada a importar.');
    return;
  }

  if (opts.dryRun) {
    for (const L of linhas.slice(0, 5)) {
      console.log(
        `  [amostra] cod=${L.codigoCliente8} proc=${L.numeroInterno} obs=${L.observacao.slice(0, 80)}${L.observacao.length > 80 ? '…' : ''}`
      );
    }
    if (linhas.length > 5) console.log(`  … e mais ${linhas.length - 5}`);
    return;
  }

  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=...');
    process.exit(1);
  }

  const token = await login(opts);
  const stats = { ok: 0, puladosVazios: 0, puladosIgual: 0, orfaos: 0, falhas: 0 };

  await runPool(linhas, opts.concurrency, async (L) => {
    try {
      const proc = await buscarProcesso(token, opts.baseUrl, L.codigoCliente8, L.numeroInterno);
      if (!proc?.id) {
        stats.orfaos += 1;
        if (stats.orfaos <= 20) {
          console.warn(`[orfão] cod=${L.codigoCliente8} proc=${L.numeroInterno} linha=${L.linhaExcel}`);
        }
        return;
      }
      const atual = String(proc.observacao ?? '').trim();
      if (opts.apenasVazios && atual) {
        stats.puladosVazios += 1;
        return;
      }
      if (atual === L.observacao.trim()) {
        stats.puladosIgual += 1;
        return;
      }
      const body = processoParaPut(proc, L.observacao);
      const r = await putProcesso(token, opts.baseUrl, Number(proc.id), body);
      if (!r.ok) {
        stats.falhas += 1;
        console.warn(
          `[falha] cod=${L.codigoCliente8} proc=${L.numeroInterno} id=${proc.id}: ${r.status} ${(r.text || '').slice(0, 150)}`
        );
        return;
      }
      stats.ok += 1;
    } catch (e) {
      stats.falhas += 1;
      console.warn(`[erro] cod=${L.codigoCliente8} proc=${L.numeroInterno}:`, e?.message || e);
    }
  });

  console.log('\n======== RELATÓRIO — OBSERVAÇÕES PROCESSO ========');
  console.log(`Atualizados: ${stats.ok}`);
  console.log(`Pulados (já tinham texto e --apenas-vazios): ${stats.puladosVazios}`);
  console.log(`Pulados (texto igual ao da planilha): ${stats.puladosIgual}`);
  console.log(`Órfãos (processo inexistente na API): ${stats.orfaos}`);
  console.log(`Falhas: ${stats.falhas}`);
  console.log('==================================================\n');
  process.exit(stats.falhas > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
