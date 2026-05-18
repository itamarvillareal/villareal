#!/usr/bin/env node
/**
 * Varre txt de vínculo processo → imóvel no Dropbox.
 *
 * Padrão: `Proc/1000/<centena>/<cliente>/<cod8>.0.89.1.<proc>.txt`
 * Conteúdo: número do imóvel (cadastro / col. A da planilha).
 *
 * Uso:
 *   node scripts/extrair-proc-imovel-vinculo-txt.mjs
 *   node scripts/extrair-proc-imovel-vinculo-txt.mjs --cliente=149
 *   node scripts/extrair-proc-imovel-vinculo-txt.mjs --csv=/tmp/proc-imovel.csv
 *   node scripts/extrair-proc-imovel-vinculo-txt.mjs --relatorio=/tmp/proc-imovel.json
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  defaultBaseProcRaiz,
  levantarVinculosImovelProc,
} from './lib/proc-imovel-vinculo-txt.mjs';

function parseArgs(argv) {
  const out = {
    baseProc: defaultBaseProcRaiz(),
    clienteFiltro: null,
    csv: null,
    relatorio: null,
  };
  for (const a of argv) {
    if (a.startsWith('--base-proc=')) out.baseProc = a.slice(12);
    else if (a.startsWith('--cliente=')) {
      const n = Number.parseInt(a.slice(10), 10);
      if (Number.isFinite(n) && n >= 1) out.clienteFiltro = Math.trunc(n);
    } else if (a.startsWith('--csv=')) out.csv = a.slice(6);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
  }
  return out;
}

function escapeCsv(s) {
  const t = String(s ?? '');
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.baseProc)) {
    console.error('Pasta Proc não encontrada:', opts.baseProc);
    process.exit(1);
  }

  const registos = levantarVinculosImovelProc(opts.baseProc, {
    clienteFiltro: opts.clienteFiltro,
  });

  const comNumero = registos.filter((r) => r.numeroPlanilha != null);
  const semNumero = registos.filter((r) => r.numeroPlanilha == null);

  const resumo = {
    baseProc: opts.baseProc,
    clienteFiltro: opts.clienteFiltro,
    total: registos.length,
    comNumeroPlanilha: comNumero.length,
    semNumeroPlanilha: semNumero.length,
    clientesDistintos: new Set(registos.map((r) => r.cod8)).size,
  };

  console.log('\n=== Vínculo processo → imóvel (Proc/*.0.89.1.*.txt) ===');
  console.log('Base:', opts.baseProc);
  if (opts.clienteFiltro != null) console.log('Cliente filtro:', opts.clienteFiltro);
  console.log(
    `Total: ${resumo.total} pares cliente|proc | com nº planilha: ${resumo.comNumeroPlanilha} | vazios/inválidos: ${resumo.semNumeroPlanilha}`
  );
  console.log('Clientes distintos:', resumo.clientesDistintos);

  const amostra = registos.slice(0, 15);
  if (amostra.length) {
    console.log('\nPrimeiros registos:');
    for (const r of amostra) {
      console.log(
        `  ${r.cod8} proc=${r.numeroInterno} imovel=${r.numeroPlanilha ?? '—'} (${r.avisoConteudo ?? 'ok'}) ← ${r.relAposBanco}`
      );
    }
    if (registos.length > amostra.length) {
      console.log(`  … +${registos.length - amostra.length} (use --csv ou --relatorio para lista completa)`);
    }
  }

  if (opts.csv) {
    const header = 'codigoCliente,numeroInternoProcesso,numeroPlanilhaImovel,textoBruto,aviso,caminho\n';
    const lines = registos.map(
      (r) =>
        [
          r.cod8,
          r.numeroInterno,
          r.numeroPlanilha ?? '',
          escapeCsv(r.texto),
          escapeCsv(r.avisoConteudo),
          escapeCsv(r.relAposBanco),
        ].join(',')
    );
    fs.writeFileSync(opts.csv, header + lines.join('\n') + '\n', 'utf8');
    console.log('\nCSV:', opts.csv);
  }

  if (opts.relatorio) {
    fs.writeFileSync(
      opts.relatorio,
      JSON.stringify({ resumo, registos }, null, 2),
      'utf8'
    );
    console.log('JSON:', opts.relatorio);
  }

  process.exit(0);
}

main();
