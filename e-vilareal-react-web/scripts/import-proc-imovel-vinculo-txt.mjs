#!/usr/bin/env node
/**
 * Importa vínculos processo → imóvel **somente** a partir de `Banco de Dados/Proc/`.
 *
 * Varre a árvore com `fs.Dirent`, identifica `*.0.89.1.*.txt`, lê o nº da planilha (col. A)
 * e grava na API em `imovel.numero_planilha` + POST `/api/imoveis/{id}/processos` (histórico N:N).
 *
 * Uso:
 *   node scripts/import-proc-imovel-vinculo-txt.mjs --dry-run
 *   VILAREAL_IMPORT_SENHA='…' node scripts/import-proc-imovel-vinculo-txt.mjs --aplicar --login=itamar
 *   node scripts/import-proc-imovel-vinculo-txt.mjs --aplicar --csv=tmp/proc-imovel-vinculo.csv
 *   node scripts/import-proc-imovel-vinculo-txt.mjs --aplicar --forcar
 *
 * `--base=` / `--base-proc=` → pasta `Proc` (ou raiz «Banco de Dados», acrescenta `Proc`).
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  levantarVinculosImovelProc,
  resolverBaseProc,
  validarRaizProc,
} from './lib/proc-imovel-vinculo-txt.mjs';
import {
  buscarProcesso,
  loginImportApi,
  resolverClienteFromApi,
} from './lib/vilareal-import-processo-api.mjs';
import {
  buscarImovelPorClientePlanilha,
  garantirImovelClientePlanilha,
  jaVinculadoProcesso,
  vincularProcessoImovel,
} from './lib/imovel-processo-vinculo-api.mjs';

function parseArgs(argv) {
  const out = {
    baseProc: resolverBaseProc(),
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8081').replace(/\/$/, ''),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    dryRun: true,
    aplicar: false,
    clienteFiltro: null,
    csv: null,
    relatorio: path.join(process.cwd(), 'tmp', 'relatorio-import-proc-imovel-vinculo.json'),
    forcar: false,
    concurrency: Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY) || 5),
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--forcar') out.forcar = true;
    else if (a.startsWith('--base=') || a.startsWith('--base-proc=')) {
      const raw = a.startsWith('--base=') ? a.slice(7) : a.slice(12);
      out.baseProc = validarRaizProc(raw);
    }
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--cliente=')) {
      const n = Number.parseInt(a.slice(10), 10);
      if (Number.isFinite(n) && n >= 1) out.clienteFiltro = Math.trunc(n);
    } else if (a.startsWith('--csv=')) out.csv = a.slice(6);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--concurrency=')) {
      out.concurrency = Math.max(1, Number(a.slice(14)) || 5);
    }
  }
  return out;
}

/** @type {Map<string, object[]>} */
const cacheImoveisPorClientePk = new Map();

async function listarImoveisPorClientePk(baseUrl, token, clientePk) {
  const key = String(clientePk);
  if (cacheImoveisPorClientePk.has(key)) return cacheImoveisPorClientePk.get(key);

  const res = await fetch(`${baseUrl}/api/imoveis`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET /api/imoveis: ${res.status} ${t.slice(0, 200)}`);
  }
  const todos = await res.json();
  const doCliente = todos.filter((i) => Number(i.clienteId) === Number(clientePk));
  cacheImoveisPorClientePk.set(key, doCliente);
  return doCliente;
}

async function buscarImovelDoCliente(baseUrl, token, clientePk, numeroPlanilha) {
  const lista = await listarImoveisPorClientePk(baseUrl, token, clientePk);
  const local = lista.find((i) => Number(i.numeroPlanilha) === Number(numeroPlanilha));
  if (local) return local;
  return buscarImovelPorClientePlanilha(baseUrl, token, clientePk, numeroPlanilha);
}

function carregarRegistos(opts) {
  if (opts.csv) {
    const text = fs.readFileSync(opts.csv, 'utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const out = [];
    for (let i = 1; i < lines.length; i += 1) {
      const [cod8, proc, np] = lines[i].split(',');
      if (!cod8 || !proc) continue;
      const numeroPlanilha = Number.parseInt(String(np).trim(), 10);
      if (!Number.isFinite(numeroPlanilha) || numeroPlanilha < 1) continue;
      out.push({
        cod8: cod8.trim(),
        codNum: Number.parseInt(cod8.trim(), 10),
        numeroInterno: Number.parseInt(proc.trim(), 10),
        numeroPlanilha,
        relAposBanco: '',
      });
    }
    return out;
  }
  return levantarVinculosImovelProc(opts.baseProc, { clienteFiltro: opts.clienteFiltro }).filter(
    (r) => r.numeroPlanilha != null
  );
}

/**
 * @param {object} opts
 * @param {string} token
 * @param {object} reg
 * @param {Map<string, { clientePk: number, pessoaId: number }>} clientePorCod8
 */
async function aplicarUmVinculo(opts, token, reg, clientePorCod8) {
  const resultado = {
    cod8: reg.cod8,
    numeroInterno: reg.numeroInterno,
    numeroPlanilha: reg.numeroPlanilha,
    acao: 'ignorado',
    mensagem: '',
    processoId: null,
    imovelId: null,
  };

  const proc = await buscarProcesso(opts.baseUrl, token, reg.cod8, reg.numeroInterno, clientePorCod8);
  if (!proc?.id) {
    resultado.acao = 'sem_processo';
    resultado.mensagem = 'Processo não encontrado na API';
    return resultado;
  }
  resultado.processoId = proc.id;

  const clienteCtx = await resolverClienteFromApi(opts.baseUrl, token, reg.cod8, clientePorCod8);
  if (!clienteCtx?.clientePk) {
    resultado.acao = 'sem_cliente';
    resultado.mensagem = 'Cliente não encontrado na API';
    return resultado;
  }
  const clientePk = clienteCtx.clientePk;

  let imovel = await buscarImovelDoCliente(opts.baseUrl, token, clientePk, reg.numeroPlanilha);

  if (imovel?.id && (await jaVinculadoProcesso(opts.baseUrl, token, imovel, proc.id))) {
    resultado.acao = 'ja_vinculado';
    resultado.imovelId = imovel.id;
    resultado.mensagem = 'Vínculo imóvel-processo já existe';
    return resultado;
  }

  if (opts.dryRun) {
    resultado.acao = imovel ? 'vincularia' : 'criaria';
    resultado.imovelId = imovel?.id ?? null;
    resultado.mensagem = imovel
      ? `POST /api/imoveis/${imovel.id}/processos processoId=${proc.id}`
      : `POST /api/imoveis (cliente ${reg.cod8}) planilha=${reg.numeroPlanilha} + vínculo processoId=${proc.id}`;
    return resultado;
  }

  if (!imovel) {
    const garantido = await garantirImovelClientePlanilha(
      opts.baseUrl,
      token,
      clientePk,
      reg.numeroPlanilha,
      {
        observacoes: `Vínculo Proc/0.89.1 (planilha legado ${reg.numeroPlanilha}).`,
      }
    );
    imovel = garantido.imovel;
    cacheImoveisPorClientePk.delete(String(clientePk));
    if (garantido.criado) {
      resultado.acao = 'criado';
    }
  }

  const obs = `Vínculo Proc/0.89.1 cod=${reg.cod8} proc=${reg.numeroInterno} planilha=${reg.numeroPlanilha}.`;
  const vinc = await vincularProcessoImovel(opts.baseUrl, token, imovel, proc.id, obs, clientePk);
  if (!vinc.ok) {
    resultado.acao = 'erro_vinculo';
    resultado.imovelId = imovel.id;
    resultado.mensagem = `${vinc.status} ${vinc.text?.slice(0, 200)}${vinc.hint ? ` — ${vinc.hint}` : ''}`;
    return resultado;
  }
  resultado.acao = vinc.idempotente ? 'ja_vinculado' : resultado.acao === 'criado' ? 'criado' : 'vinculado';
  resultado.imovelId = imovel.id;
  resultado.mensagem =
    vinc.modo === 'legado_put'
      ? 'Vínculo via PUT legado (rebuild backend V67 recomendado)'
      : vinc.idempotente
        ? 'Vínculo já existia'
        : 'Vínculo gravado em imovel_processo';
  return resultado;
}

async function runPool(items, concurrency, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  opts.baseProc = validarRaizProc(opts.baseProc);

  if (!fs.existsSync(opts.baseProc)) {
    console.error('Pasta Proc não encontrada:', opts.baseProc);
    process.exit(1);
  }

  if (!opts.dryRun && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou use --dry-run.');
    process.exit(1);
  }

  const registos = carregarRegistos(opts);
  if (!registos.length) {
    console.error('Nenhum registo para importar.');
    process.exit(1);
  }

  console.log('\n=== Import vínculo processo → imóvel (somente Banco de Dados/Proc, 0.89.1) ===');
  console.log('Pasta Proc:', opts.baseProc);
  console.log('API:', opts.baseUrl);
  console.log('Modo:', opts.dryRun ? 'dry-run' : 'aplicar');
  console.log('Registos:', registos.length);

  let token = null;
  if (opts.senha) {
    token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
  } else if (!opts.dryRun) {
    console.error('Defina VILAREAL_IMPORT_SENHA.');
    process.exit(1);
  } else {
    console.warn('Sem VILAREAL_IMPORT_SENHA — dry-run só lista registos do disco (sem consulta API).');
    process.exit(0);
  }

  const clientePorCod8 = new Map();
  const resultados = await runPool(registos, opts.concurrency, async (reg) => {
    try {
      return await aplicarUmVinculo(opts, token, reg, clientePorCod8);
    } catch (e) {
      return {
        cod8: reg.cod8,
        numeroInterno: reg.numeroInterno,
        numeroPlanilha: reg.numeroPlanilha,
        acao: 'erro',
        mensagem: e?.message || String(e),
        processoId: null,
        imovelId: null,
      };
    }
  });

  const contagem = {};
  for (const r of resultados) {
    contagem[r.acao] = (contagem[r.acao] || 0) + 1;
  }

  console.log('\nResumo:', contagem);

  const problemas = resultados.filter((r) =>
    [
      'sem_processo',
      'sem_cliente',
      'erro',
      'erro_criar',
      'erro_atualizar',
    ].includes(r.acao)
  );
  if (problemas.length) {
    console.log('\nPendências / erros (até 20):');
    for (const p of problemas.slice(0, 20)) {
      console.log(
        `  ${p.cod8} proc=${p.numeroInterno} imovel=${p.numeroPlanilha} → ${p.acao}: ${p.mensagem}`
      );
    }
  }

  if (opts.relatorio) {
    fs.mkdirSync(path.dirname(opts.relatorio), { recursive: true });
    fs.writeFileSync(
      opts.relatorio,
      JSON.stringify(
        {
          geradoEm: new Date().toISOString(),
          opts: {
            baseUrl: opts.baseUrl,
            dryRun: opts.dryRun,
            forcar: opts.forcar,
            total: registos.length,
          },
          contagem,
          resultados,
        },
        null,
        2
      ),
      'utf8'
    );
    console.log('\nRelatório:', opts.relatorio);
  }

  const falhas =
    (contagem.erro || 0) +
    (contagem.erro_criar || 0) +
    (contagem.erro_atualizar || 0);
  const avisos =
    (contagem.sem_processo || 0) +
    (contagem.conflito_processo || 0) +
    (contagem.sem_cliente || 0) +
    (contagem.planilha_outro_cliente || 0) +
    (contagem.sem_imovel_no_cliente || 0);
  process.exit(falhas > 0 ? 1 : avisos > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
