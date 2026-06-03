#!/usr/bin/env node
/**
 * Importação de rodadas de cálculo a partir dos txt em Dropbox «Banco de Dados/Calculos».
 *
 * Espelha o legado VBA (`Formulario = "Taxas Condominiais"`, `[Módulo2].avaliacao`).
 *
 * Uso:
 *   node scripts/import-calculos-txt.mjs --cliente=728 --dry-run
 *   node scripts/import-calculos-txt.mjs --cliente=728 --processo=702 --dimensao=0 --dry-run
 *   node scripts/import-calculos-txt.mjs --cliente=728 --aplicar
 *
 * Credenciais: `.env.import.local` (como import-real / import-calculos-planilha)
 *
 * Opções:
 *   --cliente=N           Obrigatório (1..999)
 *   --dry-run | --aplicar
 *   --processo=N          Filtra nº interno do processo (segmento no nome do txt)
 *   --processo-min= --processo-max=
 *   --dimensao=N          Filtra dimensão
 *   --base=PATH           Raiz «Banco de Dados»
 *   --relatorio=JSON      Grava resumo JSON
 *   --limite-rodadas=N    Em dry-run, máximo de rodadas detalhadas (defeito 30)
 *   --strict              Aborta se alguma rodada falhar validação de fidelidade ao txt
 *
 * Fidelidade ao legado:
 *   - Lê config da dimensão `{cod8}.{dim}.129.1.txt` (honorários %), 130, 131, 132, 149
 *   - Usa snapshot dos txt quando há juros por linha (106) ou totais (119+), mesmo sem `.105.1.{proc}=SIM`
 *   - `.105.1.{proc}.{NNN}` guarda dias de atraso — não confundir com aceite global
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { formatCod8 } from './lib/historico-local-txt-paths.mjs';
import {
  carregarBundleCalculosCliente,
  diagnosticarRodadaImport,
  dirCalculosCliente,
  montarPayloadRodadaComRecalculo,
  resumirConfigDimensaoBundle,
} from './lib/calculos-dropbox-txt.mjs';

function parseArgs(argv) {
  const out = {
    cliente: null,
    processo: null,
    processoMin: null,
    processoMax: null,
    dimensao: null,
    dryRun: true,
    aplicar: false,
    base: resolverBaseBancoDados(),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    relatorio: null,
    limiteRodadas: 30,
    strict: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a.startsWith('--cliente=')) out.cliente = Number(a.slice(10));
    else if (a.startsWith('--processo=')) out.processo = Number(a.slice(11));
    else if (a.startsWith('--processo-min=')) out.processoMin = Number(a.slice(15));
    else if (a.startsWith('--processo-max=')) out.processoMax = Number(a.slice(15));
    else if (a.startsWith('--dimensao=')) out.dimensao = Number(a.slice(11));
    else if (a.startsWith('--base=')) out.base = a.slice(7);
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--limite-rodadas=')) out.limiteRodadas = Math.max(0, Number(a.slice(17)) || 0);
    else if (a === '--strict') out.strict = true;
  }
  return out;
}

async function loginApi(baseUrl, login, senha) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, senha }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Login falhou ${res.status}: ${txt.slice(0, 200)}`);
  const data = JSON.parse(txt);
  const token = data.accessToken ?? data.token;
  if (!token) throw new Error('Resposta login sem accessToken');
  return token;
}

async function putRodada(baseUrl, token, item) {
  const url = `${baseUrl}/api/calculos/rodadas/${item.cod8}/${item.numeroProcesso}/${item.dimensao}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(item.payload),
  });
  const txt = await res.text();
  return { ok: res.status === 200 || res.status === 201, status: res.status, body: txt.slice(0, 400) };
}

async function filtrarRodadas(bundle, opts) {
  const items = [];
  for (const [, rodada] of bundle.porRodada) {
    if (opts.processo != null && rodada.numeroProcesso !== opts.processo) continue;
    if (opts.processoMin != null && rodada.numeroProcesso < opts.processoMin) continue;
    if (opts.processoMax != null && rodada.numeroProcesso > opts.processoMax) continue;
    if (opts.dimensao != null && rodada.dimensao !== opts.dimensao) continue;
    const payload = await montarPayloadRodadaComRecalculo(rodada, { baseBanco: opts.base });
    const diagnostico = diagnosticarRodadaImport(rodada, payload);
    items.push({
      key: rodada.key,
      cod8: rodada.cod8,
      numeroProcesso: rodada.numeroProcesso,
      dimensao: rodada.dimensao,
      aceito: diagnostico.aceito,
      recalculado: diagnostico.recalculado,
      modo: diagnostico.modo,
      honorariosPainel: diagnostico.honorariosPainel,
      dataCalculo: diagnostico.dataCalculo,
      totalTaxas: diagnostico.totalTaxas,
      avisos: diagnostico.avisos,
      ficheiros: rodada.paths.length,
      debitos: payload.debitos?.length ?? 0,
      titulos: payload.titulos?.length ?? 0,
      parcelas: payload.parcelas?.length ?? 0,
      payload,
    });
  }
  items.sort((a, b) => {
    const d = a.dimensao - b.dimensao;
    if (d !== 0) return d;
    return a.numeroProcesso - b.numeroProcesso;
  });
  return items;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.cliente || !Number.isFinite(opts.cliente) || opts.cliente < 1) {
    console.error('[import-calculos-txt] --cliente=N é obrigatório');
    process.exit(1);
  }
  if (!opts.dryRun && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=... (ou use --dry-run)');
    process.exit(1);
  }

  const codNum = Math.trunc(opts.cliente);
  const cod8 = formatCod8(codNum);
  const dir = dirCalculosCliente(codNum, opts.base);

  console.log(`[import-calculos-txt] cliente=${cod8} dir=${dir}`);
  if (!fs.existsSync(dir)) {
    console.error('[import-calculos-txt] pasta Calculos do cliente não existe');
    process.exit(1);
  }

  const bundle = carregarBundleCalculosCliente(codNum, {
    baseBanco: opts.base,
    processoMin: opts.processoMin ?? undefined,
    processoMax: opts.processoMax ?? undefined,
  });

  const items = await filtrarRodadas(bundle, opts);
  const aceitos = items.filter((i) => i.aceito);
  const comDebitos = items.filter((i) => i.debitos > 0);
  const snapshots = items.filter((i) => i.modo === 'snapshot');
  const recalculados = items.filter((i) => i.recalculado);
  const comAvisos = items.filter((i) => i.avisos.length > 0);

  const configDim = resumirConfigDimensaoBundle(bundle);
  if (Object.keys(configDim).length) {
    console.log(`[import-calculos-txt] config dimensão: ${JSON.stringify(configDim)}`);
  }

  console.log(
    `[import-calculos-txt] rodadas=${items.length} aceitas=${aceitos.length} snapshot=${snapshots.length} recalc=${recalculados.length} com_debitos=${comDebitos.length} avisos=${comAvisos.length}`,
  );
  if (bundle.ficheirosIgnorados.length) {
    console.log(`[import-calculos-txt] ficheiros ignorados (nome inválido): ${bundle.ficheirosIgnorados.length}`);
  }

  const detalhe = items.slice(0, opts.limiteRodadas);
  for (const it of detalhe) {
    const extras = [
      `modo=${it.modo}`,
      it.honorariosPainel ? `hon=${it.honorariosPainel}` : null,
      it.dataCalculo ? `data=${it.dataCalculo}` : null,
      it.totalTaxas ? `tot=${it.totalTaxas}` : null,
    ]
      .filter(Boolean)
      .join(' ');
    console.log(
      `  ${it.key} aceito=${it.aceito ? 'SIM' : 'nao'} ${extras} ficheiros=${it.ficheiros} titulos=${it.titulos} debitos=${it.debitos} parcelas=${it.parcelas}`,
    );
    for (const av of it.avisos) {
      console.warn(`    [AVISO] ${av}`);
    }
  }
  if (items.length > detalhe.length) {
    console.log(`  ... +${items.length - detalhe.length} rodadas (use --limite-rodadas=0 para listar todas)`);
  }

  const resumo = {
    cliente: codNum,
    cod8,
    dir,
    modo: opts.dryRun ? 'dry-run' : 'aplicar',
    rodadas: items.length,
    aceitas: aceitos.length,
    comDebitos: comDebitos.length,
    ignorados: bundle.ficheirosIgnorados.length,
    configDimensao: configDim,
    snapshot: snapshots.length,
    recalculados: recalculados.length,
    avisos: comAvisos.length,
    amostra: detalhe.map((it) => ({
      key: it.key,
      aceito: it.aceito,
      modo: it.modo,
      honorariosPainel: it.honorariosPainel,
      dataCalculo: it.dataCalculo,
      totalTaxas: it.totalTaxas,
      avisos: it.avisos,
      ficheiros: it.ficheiros,
      debitos: it.debitos,
      parcelas: it.parcelas,
    })),
  };

  if (comAvisos.length) {
    console.warn(`[import-calculos-txt] ${comAvisos.length} rodada(s) com aviso de fidelidade`);
    if (opts.strict) {
      console.error('[import-calculos-txt] abortado (--strict)');
      process.exit(1);
    }
  }

  if (opts.dryRun) {
    if (opts.relatorio) {
      fs.writeFileSync(opts.relatorio, `${JSON.stringify(resumo, null, 2)}\n`);
      console.log(`[import-calculos-txt] relatório: ${opts.relatorio}`);
    }
    return;
  }

  const token = await loginApi(opts.baseUrl, opts.login, opts.senha);
  let ok = 0;
  let falhas = 0;
  for (const it of items) {
    const r = await putRodada(opts.baseUrl, token, it);
    if (r.ok) {
      ok++;
      console.log(`[OK] ${it.key}`);
    } else {
      falhas++;
      console.warn(`[FALHA] ${it.key} HTTP ${r.status} ${r.body}`);
    }
  }
  resumo.putOk = ok;
  resumo.putFalhas = falhas;
  console.log(`[import-calculos-txt] PUT ok=${ok} falhas=${falhas}`);

  if (opts.relatorio) {
    fs.writeFileSync(opts.relatorio, `${JSON.stringify(resumo, null, 2)}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
