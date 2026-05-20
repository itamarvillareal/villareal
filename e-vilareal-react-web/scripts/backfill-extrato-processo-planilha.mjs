#!/usr/bin/env node
/**
 * Garante processos na API (pessoa = dígitos do código na col. L) e vincula lançamentos
 * de extrato quando a planilha tem nº interno na col. M mas processoId ficou null na API.
 *
 * Uso (e-vilareal-react-web/):
 *   node scripts/backfill-extrato-processo-planilha.mjs --dry-run
 *   node scripts/backfill-extrato-processo-planilha.mjs --aplicar
 *   node scripts/backfill-extrato-processo-planilha.mjs --aplicar --codigo=00000938 --processo=41
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import process from 'node:process';
import XLSX from 'xlsx';

import { BANCOS_IMPORT_PLANILHA } from './lib/extrato-bancos-planilha-constantes.mjs';
import {
  extrairLancamentosDaAba,
  layoutExtratoPorNomeInstituicao,
} from './lib/extrato-bancos-planilha-layouts.mjs';
import { normalizarCodigoCliente8 } from './lib/extrato-bancos-planilha-parse.mjs';
import {
  candidatosExtratoBancosPlanilhaXlsParaLog,
  resolveExtratoBancosPlanilhaXlsPath,
} from './lib/resolve-extrato-bancos-planilha-xls.mjs';
import {
  criarProcessoStubImport,
  loginImportApi,
} from './lib/vilareal-import-processo-api.mjs';

function parseArgs(argv) {
  const out = {
    file: null,
    dryRun: true,
    banco: null,
    desde: null,
    ate: null,
    codigo: null,
    processo: null,
    limite: null,
    concurrency: Math.min(
      16,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 8) || 8),
    ),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
  };
  for (const a of argv) {
    if (a === '--aplicar') out.dryRun = false;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--banco=')) out.banco = a.slice(8).trim();
    else if (a.startsWith('--desde=')) out.desde = a.slice(8).trim();
    else if (a.startsWith('--ate=')) out.ate = a.slice(6).trim();
    else if (a.startsWith('--codigo=')) out.codigo = normalizarCodigoCliente8(a.slice(9));
    else if (a.startsWith('--processo=')) out.processo = Number(a.slice(11));
    else if (a.startsWith('--limite=')) out.limite = Number(a.slice(9));
    else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(24, Math.floor(n));
    }
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (!a.startsWith('-')) out.file = a;
  }
  if (!out.file) {
    const resolved = resolveExtratoBancosPlanilhaXlsPath(null);
    if (!resolved) {
      console.error(
        'Planilha não encontrada. Tentados:\n',
        candidatosExtratoBancosPlanilhaXlsParaLog(null).map((p) => `  ${p}`).join('\n'),
      );
      process.exit(1);
    }
    out.file = resolved;
  }
  return out;
}

/** Pessoa id = dígitos do código (00000938 → 938), alinhado ao clienteId do extrato. */
export function pessoaIdDoCodigoCliente(cod8) {
  const norm = normalizarCodigoCliente8(cod8);
  if (!norm) return null;
  const n = Number.parseInt(norm.replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function buscarProcessoNaPessoa(baseUrl, token, pessoaId, numeroInterno) {
  const ni = Math.trunc(Number(numeroInterno));
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const res = await fetch(
    `${baseUrl}/api/processos/por-numero-interno?${new URLSearchParams({ numeroInterno: String(ni) })}`,
    { headers },
  );
  if (!res.ok) return null;
  const lista = await res.json();
  if (!Array.isArray(lista)) return null;
  return lista.find((p) => Number(p?.clienteId) === Number(pessoaId)) ?? null;
}

async function garantirProcessoNaPessoa(baseUrl, token, pessoaId, numeroInterno, dryRun) {
  let proc = await buscarProcessoNaPessoa(baseUrl, token, pessoaId, numeroInterno);
  if (proc?.id) return { ok: true, criado: false, processo: proc };

  if (dryRun) {
    return { ok: true, criado: true, processo: null, dryRunStub: true };
  }

  const r = await criarProcessoStubImport(
    baseUrl,
    token,
    pessoaId,
    numeroInterno,
    'Processo garantido para vínculo extrato (planilha col. M).',
  );
  if (!r.ok) {
    return { ok: false, erro: `POST processo: ${r.status} ${r.text}` };
  }

  proc = await buscarProcessoNaPessoa(baseUrl, token, pessoaId, numeroInterno);
  if (!proc?.id) {
    return { ok: false, erro: 'stub criado mas processo não encontrado na pessoa' };
  }
  return { ok: true, criado: true, processo: proc };
}

function lancamentoParaPut(l, processoId) {
  return {
    contaContabilId: l.contaContabilId,
    clienteId: l.clienteId ?? null,
    processoId: processoId ?? l.processoId ?? null,
    bancoNome: l.bancoNome,
    numeroBanco: l.numeroBanco,
    numeroLancamento: l.numeroLancamento,
    dataLancamento: l.dataLancamento,
    dataCompetencia: l.dataCompetencia ?? l.dataLancamento,
    descricao: l.descricao,
    descricaoDetalhada: l.descricaoDetalhada ?? '',
    valor: l.valor,
    natureza: l.natureza,
    refTipo: l.refTipo || 'N',
    origem: l.origem,
    status: l.status || 'ATIVO',
    grupoCompensacao: l.grupoCompensacao ?? null,
  };
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

async function putLancamento(baseUrl, token, id, body) {
  const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  return { ok: res.ok, status: res.status, text: txt.slice(0, 400) };
}

async function carregarLancamentosApi(baseUrl, token) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const res = await fetch(`${baseUrl}/api/financeiro/lancamentos`, { headers });
  if (!res.ok) {
    throw new Error(`GET lancamentos: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const lista = await res.json();
  const porNumero = new Map();
  for (const l of lista || []) {
    if (l?.numeroLancamento) porNumero.set(l.numeroLancamento, l);
  }
  return porNumero;
}

function coletarLinhasPlanilha(opts, wb) {
  const bancos = opts.banco ? [opts.banco] : BANCOS_IMPORT_PLANILHA;
  const out = [];
  for (const nome of bancos) {
    const ws = wb.Sheets[nome];
    if (!ws) continue;
    const layout = layoutExtratoPorNomeInstituicao(nome);
    let linhas = extrairLancamentosDaAba(ws, layout, nome);
    if (opts.desde) linhas = linhas.filter((r) => r.dataIso >= opts.desde);
    if (opts.ate) linhas = linhas.filter((r) => r.dataIso <= opts.ate);
    if (opts.codigo) {
      linhas = linhas.filter((r) => r.codigoCliente === opts.codigo);
    }
    if (opts.processo != null && Number.isFinite(opts.processo)) {
      linhas = linhas.filter((r) => r.numeroInterno === Math.trunc(opts.processo));
    }
    for (const row of linhas) {
      if (row.letra !== 'A' || !row.codigoCliente || row.numeroInterno == null) continue;
      out.push({ ...row, bancoNome: nome });
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
    process.exit(1);
  }
  if (!fs.existsSync(opts.file)) {
    console.error(`Planilha não encontrada: ${opts.file}`);
    process.exit(1);
  }

  console.log(`Planilha: ${opts.file}`);
  console.log(`API: ${opts.baseUrl}`);
  console.log(`Modo: ${opts.dryRun ? 'dry-run' : 'APLICAR'}`);

  const token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
  const porNumero = await carregarLancamentosApi(opts.baseUrl, token);
  console.log(`Lançamentos na API: ${porNumero.size}`);

  const wb = XLSX.readFile(opts.file, { cellDates: true, cellNF: false });
  let linhas = coletarLinhasPlanilha(opts, wb);
  if (opts.limite != null) linhas = linhas.slice(0, opts.limite);
  console.log(`Linhas planilha (A + código + proc.): ${linhas.length}`);

  const stats = {
    semLancamentoApi: 0,
    jaVinculado: 0,
    clienteAusente: 0,
    clienteDivergeCodigo: 0,
    processoGarantido: 0,
    stubCriado: 0,
    putOk: 0,
    putErro: 0,
    processoFalhou: 0,
  };
  const amostra = [];
  const cacheProc = new Map();
  const pendentesPut = [];

  for (const row of linhas) {
    const api = porNumero.get(row.numeroLancamento);
    if (!api) {
      stats.semLancamentoApi += 1;
      continue;
    }
    if (api.processoId != null) {
      stats.jaVinculado += 1;
      continue;
    }

    const pessoaCodigo = pessoaIdDoCodigoCliente(row.codigoCliente);
    const pessoaId =
      api.clienteId != null ? Number(api.clienteId) : pessoaCodigo;
    if (pessoaId == null || !Number.isFinite(pessoaId)) {
      stats.clienteAusente += 1;
      continue;
    }
    if (pessoaCodigo != null && api.clienteId != null && Number(api.clienteId) !== pessoaCodigo) {
      stats.clienteDivergeCodigo += 1;
      if (amostra.length < 15) {
        amostra.push({
          tipo: 'clienteDiverge',
          linha: row.linhaExcel,
          banco: row.bancoNome,
          codigo: row.codigoCliente,
          clienteIdApi: api.clienteId,
          pessoaCodigo,
          proc: row.numeroInterno,
        });
      }
    }

    const chaveProc = `${pessoaId}:${row.numeroInterno}`;
    let procId = cacheProc.get(chaveProc);
    if (procId === undefined) {
      const g = await garantirProcessoNaPessoa(
        opts.baseUrl,
        token,
        pessoaId,
        row.numeroInterno,
        opts.dryRun,
      );
      if (!g.ok) {
        stats.processoFalhou += 1;
        if (amostra.length < 20) {
          amostra.push({
            tipo: 'processoFalhou',
            linha: row.linhaExcel,
            pessoaId,
            proc: row.numeroInterno,
            erro: g.erro,
          });
        }
        continue;
      }
      if (g.criado) stats.stubCriado += 1;
      stats.processoGarantido += 1;
      procId = g.processo?.id ?? null;
      cacheProc.set(chaveProc, procId);
    }

    if (!procId) {
      if (opts.dryRun) {
        if (amostra.length < 25) {
          amostra.push({
            tipo: 'dryRunVincular',
            id: api.id,
            linha: row.linhaExcel,
            banco: row.bancoNome,
            data: row.dataIso,
            pessoaId,
            proc: row.numeroInterno,
            desc: row.descricao?.slice(0, 60),
          });
        }
        stats.putOk += 1;
      }
      continue;
    }

    if (opts.dryRun) {
      stats.putOk += 1;
      if (amostra.length < 25) {
        amostra.push({
          tipo: 'dryRunVincular',
          id: api.id,
          processoId: procId,
          linha: row.linhaExcel,
          pessoaId,
          proc: row.numeroInterno,
        });
      }
      continue;
    }

    pendentesPut.push({ api, procId, pessoaId, proc: row.numeroInterno });
  }

  if (!opts.dryRun && pendentesPut.length) {
    console.log(`PUT em lote: ${pendentesPut.length} (concurrency ${opts.concurrency})`);
    await runPool(pendentesPut, opts.concurrency, async ({ api, procId, pessoaId, proc }) => {
      const body = lancamentoParaPut(api, procId);
      const put = await putLancamento(opts.baseUrl, token, api.id, body);
      if (put.ok) stats.putOk += 1;
      else {
        stats.putErro += 1;
        if (amostra.length < 20) {
          amostra.push({
            tipo: 'putErro',
            id: api.id,
            status: put.status,
            texto: put.text,
            pessoaId,
            proc,
          });
        }
      }
    });
  }

  console.log('\n--- Resumo ---');
  console.log(JSON.stringify(stats, null, 2));
  if (amostra.length) {
    console.log('\nAmostra:');
    for (const a of amostra) console.log(' ', JSON.stringify(a));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
