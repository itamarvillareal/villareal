#!/usr/bin/env node
/**
 * Varre `Gerais/145.1` (anos → meses → txt), levanta prazos fatais e actualiza a API.
 *
 * Nome do ficheiro: `00000985.145.1.110.txt` → cliente 985 (8 dígitos), processo 110 (após último ponto).
 * Conteúdo: data do prazo fatal (dd/mm/aaaa), uma linha.
 *
 * Actualiza:
 *   - coluna `processo.prazo_fatal` (PUT /api/processos/{id})
 *   - registo em `processo_prazo` com `prazo_fatal=true` (POST ou PUT …/prazos)
 *
 * Uso:
 *   node scripts/import-prazos-fatais-gerais-145-1.mjs --dry-run
 *   VILAREAL_IMPORT_SENHA='…' node scripts/import-prazos-fatais-gerais-145-1.mjs --aplicar --login=itamar
 *   node scripts/import-prazos-fatais-gerais-145-1.mjs --dry-run --cliente=728 --relatorio=/tmp/prazos-145-1.json
 *
 * Opções:
 *   --base=PATH           Raiz 145.1 (defeito: ~/Dropbox/Banco de Dados/Gerais/145.1)
 *   --dry-run             Só levantamento (defeito sem --aplicar)
 *   --aplicar             Grava na API
 *   --login= --senha=
 *   --cliente=N           Só um código cliente (1..999)
 *   --ano-min= --ano-max=
 *   --apenas-diferentes   Ignora processos cuja data na API já coincide
 *   --relatorio=JSON
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  DEFAULT_BASE_GERAIS_145_1,
  deduplicarPrazosFatais145_1,
  iterarPrazosFatais145_1,
  parseDataPrazoFatalTxt,
  parseNomeArquivo145_1,
} from './lib/gerais-145-1-prazo-fatal.mjs';

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE_GERAIS_145_1,
    dryRun: true,
    aplicar: false,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    clienteFiltro: null,
    anoMin: 2017,
    anoMax: 2026,
    apenasDiferentes: false,
    relatorio: null,
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    concurrency: Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY) || 5),
  };

  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--apenas-diferentes') out.apenasDiferentes = true;
    else if (a.startsWith('--base=')) out.base = a.slice(7);
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.clienteFiltro = Math.trunc(n);
    } else if (a.startsWith('--ano-min=')) out.anoMin = Number(a.slice(10)) || 2017;
    else if (a.startsWith('--ano-max=')) out.anoMax = Number(a.slice(10)) || 2026;
    else if (a.startsWith('--concurrency=')) out.concurrency = Math.max(1, Number(a.slice(14)) || 5);
  }

  return out;
}

async function login(opts) {
  const res = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: String(opts.login).trim().toLowerCase(), senha: opts.senha }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Login falhou ${res.status}: ${t.slice(0, 400)}`);
  }
  const json = await res.json();
  if (!json.accessToken) throw new Error('Login sem accessToken');
  return json.accessToken;
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {string} cod8
 * @param {number} numeroInterno
 */
async function buscarProcesso(baseUrl, token, cod8, numeroInterno) {
  const url = `${baseUrl}/api/processos?${new URLSearchParams({
    codigoCliente: cod8,
    numeroInterno: String(numeroInterno),
  })}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET processo ${cod8}/${numeroInterno}: ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

/** @param {object} p @param {string} prazoFatalIso */
function corpoPutProcesso(p, prazoFatalIso) {
  return {
    clienteId: p.clienteId ?? p.pessoaId,
    numeroInterno: p.numeroInterno,
    numeroCnj: p.numeroCnj ?? null,
    numeroProcessoAntigo: p.numeroProcessoAntigo ?? null,
    naturezaAcao: p.naturezaAcao ?? null,
    descricaoAcao: p.descricaoAcao ?? null,
    competencia: p.competencia ?? null,
    fase: p.fase ?? null,
    observacaoFase: p.observacaoFase ?? null,
    tramitacao: p.tramitacao ?? null,
    dataProtocolo: p.dataProtocolo ?? null,
    prazoFatal: prazoFatalIso,
    proximaConsulta: p.proximaConsulta ?? null,
    observacao: p.observacao ?? null,
    valorCausa: p.valorCausa ?? null,
    uf: p.uf ?? null,
    cidade: p.cidade ?? null,
    unidade: p.unidade ?? null,
    pasta: p.pasta ?? null,
    consultaAutomatica: p.consultaAutomatica ?? false,
    ativo: p.ativo ?? true,
    consultor: p.consultor ?? null,
    usuarioResponsavelId: p.usuarioResponsavelId ?? null,
  };
}

function normalizarDataApi(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : null;
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} processoId
 * @param {string} dataFimIso yyyy-mm-dd
 */
async function upsertPrazoFatalEntidade(baseUrl, token, processoId, dataFimIso) {
  const listUrl = `${baseUrl}/api/processos/${processoId}/prazos`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!listRes.ok) {
    const t = await listRes.text();
    throw new Error(`GET prazos ${processoId}: ${listRes.status} ${t.slice(0, 200)}`);
  }
  const prazos = await listRes.json();
  const existente = Array.isArray(prazos)
    ? prazos.find((z) => z.prazoFatal === true)
    : null;

  const body = {
    andamentoId: null,
    descricao: 'Prazo fatal do processo',
    dataInicio: null,
    dataFim: dataFimIso,
    prazoFatal: true,
    status: existente?.status || 'PENDENTE',
    observacao: null,
  };

  if (existente?.id) {
    const res = await fetch(`${listUrl}/${existente.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`PUT prazo ${existente.id}: ${res.status} ${t.slice(0, 200)}`);
    }
    return 'put';
  }

  const res = await fetch(listUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`POST prazo: ${res.status} ${t.slice(0, 200)}`);
  }
  return 'post';
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {object} proc resposta GET processo
 * @param {string} prazoFatalIso
 */
async function atualizarPrazoFatalProcesso(baseUrl, token, proc, prazoFatalIso) {
  const putBody = corpoPutProcesso(proc, prazoFatalIso);
  const res = await fetch(`${baseUrl}/api/processos/${proc.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(putBody),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PUT processo ${proc.id}: ${res.status} ${t.slice(0, 200)}`);
  }
  await upsertPrazoFatalEntidade(baseUrl, token, proc.id, prazoFatalIso);
}

async function runPool(items, concurrency, fn) {
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('\n=== Prazos fatais — Gerais/145.1 ===');
  console.log(`Base: ${opts.base}`);
  console.log(`Modo: ${opts.dryRun ? 'dry-run (levantamento)' : 'aplicar na API'}`);
  console.log('');

  if (!fs.existsSync(opts.base)) {
    console.error(`Pasta não encontrada: ${opts.base}`);
    process.exit(1);
  }

  let ficheirosLidos = 0;
  let nomeInvalido = 0;
  let dataInvalida = 0;

  /** @type {object[]} */
  const brutos = [];
  for (const e of iterarPrazosFatais145_1(opts.base, {
    anoMin: opts.anoMin,
    anoMax: opts.anoMax,
    clienteFiltro: opts.clienteFiltro,
  })) {
    brutos.push(e);
    ficheirosLidos += 1;
  }

  for (const yyyy of Array.from({ length: opts.anoMax - opts.anoMin + 1 }, (_, i) => opts.anoMin + i)) {
    const dirAno = path.join(opts.base, String(yyyy));
    if (!fs.existsSync(dirAno)) continue;
    for (let mm = 1; mm <= 12; mm += 1) {
      const dirMes = path.join(dirAno, String(mm).padStart(2, '0'));
      if (!fs.existsSync(dirMes)) continue;
      let files;
      try {
        files = fs.readdirSync(dirMes).filter((x) => x.toLowerCase().endsWith('.txt'));
      } catch {
        continue;
      }
      for (const f of files) {
        const parsed = parseNomeArquivo145_1(f);
        if (!parsed) {
          nomeInvalido += 1;
          continue;
        }
        if (opts.clienteFiltro != null && parsed.codNum !== opts.clienteFiltro) continue;
        try {
          const raw = fs.readFileSync(path.join(dirMes, f), 'utf8');
          if (!parseDataPrazoFatalTxt(raw, mm)) dataInvalida += 1;
        } catch {
          dataInvalida += 1;
        }
      }
    }
  }

  const registos = deduplicarPrazosFatais145_1(brutos);
  const duplicadosDescartados = ficheirosLidos - registos.length;

  console.log(`Ficheiros com data válida: ${ficheirosLidos}`);
  console.log(`Registos únicos (cliente+proc): ${registos.length}`);
  console.log(`Duplicados (pasta mais recente vence): ${duplicadosDescartados}`);
  console.log(`Nomes de ficheiro inválidos: ${nomeInvalido}`);
  console.log(`Datas inválidas/vazias no txt: ${dataInvalida}`);
  console.log('');

  const stats = {
    ok: 0,
    puladosIguais: 0,
    semProcesso: 0,
    falhas: 0,
  };

  /** @type {object[]} */
  const detalhes = [];
  /** @type {object[]} */
  const amostra = registos.slice(0, 15);

  let token = null;
  if (!opts.dryRun) {
    if (!opts.senha) {
      console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
      process.exit(1);
    }
    token = await login(opts);
    console.log('[api] Login OK\n');
  }

  await runPool(registos, opts.dryRun ? 1 : opts.concurrency, async (reg) => {
    /** @type {object} */
    const linha = {
      cod8: reg.cod8,
      numeroInterno: reg.numeroInterno,
      prazoFatal: reg.prazoFatalIso,
      arquivo: reg.relPath,
    };

    if (opts.dryRun) {
      stats.ok += 1;
      if (detalhes.length < 5000) detalhes.push({ ...linha, acao: 'dry-run' });
      return;
    }

    try {
      const proc = await buscarProcesso(opts.baseUrl, token, reg.cod8, reg.numeroInterno);
      if (!proc?.id) {
        stats.semProcesso += 1;
        linha.acao = 'sem_processo';
        detalhes.push(linha);
        return;
      }

      const atual = normalizarDataApi(proc.prazoFatal);
      if (opts.apenasDiferentes && atual === reg.prazoFatalIso) {
        stats.puladosIguais += 1;
        linha.acao = 'pulado_igual';
        linha.prazoAnterior = atual;
        detalhes.push(linha);
        return;
      }

      await atualizarPrazoFatalProcesso(opts.baseUrl, token, proc, reg.prazoFatalIso);
      stats.ok += 1;
      linha.acao = atual ? 'atualizado' : 'criado';
      linha.prazoAnterior = atual;
      linha.processoId = proc.id;
      detalhes.push(linha);
    } catch (e) {
      stats.falhas += 1;
      linha.acao = 'falha';
      linha.erro = String(e?.message ?? e).slice(0, 300);
      detalhes.push(linha);
      console.warn(`[falha] ${reg.cod8} proc ${reg.numeroInterno}: ${linha.erro}`);
    }
  });

  console.log('\n--- Resumo ---');
  console.log(`  ${opts.dryRun ? 'Registos no levantamento' : 'Atualizados'}: ${stats.ok}`);
  if (!opts.dryRun) {
    console.log(`  Pulados (já iguais): ${stats.puladosIguais}`);
    console.log(`  Sem processo na API: ${stats.semProcesso}`);
    console.log(`  Falhas: ${stats.falhas}`);
  }

  console.log('\nAmostra (15 primeiros):');
  for (const a of amostra) {
    console.log(
      `  ${a.cod8} proc ${a.numeroInterno} → ${a.prazoFatalIso}  (${a.relPath})`
    );
  }

  const payload = {
    geradoEm: new Date().toISOString(),
    base: opts.base,
    stats: {
      ficheirosLidos,
      registosUnicos: registos.length,
      duplicadosDescartados,
      ...stats,
    },
    amostra,
    detalhes: opts.relatorio ? detalhes : detalhes.slice(0, 200),
  };

  if (opts.relatorio) {
    fs.writeFileSync(opts.relatorio, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`\nRelatório: ${opts.relatorio}`);
  }

  console.log('');
  if (!opts.dryRun && stats.falhas > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
