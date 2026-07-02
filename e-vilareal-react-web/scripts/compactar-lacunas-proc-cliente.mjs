#!/usr/bin/env node
/**
 * Preenche lacunas de numero_interno após exclusões (último proc → menor buraco).
 *
 *   node scripts/compactar-lacunas-proc-cliente.mjs --cod=928 --vps
 *   node scripts/compactar-lacunas-proc-cliente.mjs --cod=928 --vps --lacuna-min=203 --confirmar=COMPACTAR-928
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';
import { aplicarPerfilConexao, parseFlagVps } from './lib/mysql-alvo-vilareal.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { compactarLacunasProcClienteMysql } from './lib/compactar-lacunas-proc-cliente.mjs';

const CONFIRMAR_PREFIX = 'COMPACTAR-';

function parseArgs(argv) {
  let cod = '928';
  let lacunaMin = 1;
  let confirmar = null;
  let vps = false;
  for (const a of argv) {
    if (a.startsWith('--cod=')) cod = a.slice(6);
    else if (a.startsWith('--lacuna-min=')) lacunaMin = Number(a.slice(13));
    else if (a.startsWith('--confirmar=')) confirmar = a.slice(12);
    else if (a === '--vps') vps = true;
  }
  vps = vps || parseFlagVps(argv);
  const esperado = `${CONFIRMAR_PREFIX}${String(cod).replace(/\D/g, '')}`;
  return {
    cod,
    lacunaMin,
    vps,
    dryRun: confirmar !== esperado,
    confirmarEsperado: esperado,
  };
}

const opts = parseArgs(process.argv.slice(2));
const perfil = aplicarPerfilConexao({ vps: opts.vps });

console.log('\n=== Compactar lacunas numero_interno ===');
console.log(`Alvo: ${perfil.alvo}`);
console.log(`Cliente: ${opts.cod}`);
console.log(`Lacuna mínima: ${opts.lacunaMin}`);
console.log(`Modo: ${opts.dryRun ? 'simulação' : 'APLICAR'}\n`);

const conn = await conectarMysqlVilareal();
try {
  const res = await compactarLacunasProcClienteMysql(conn, {
    cod8: opts.cod,
    lacunaMin: opts.lacunaMin,
    dryRun: opts.dryRun,
  });

  console.log(`Lacunas: ${res.lacunas?.length ?? 0} (max atual ${res.maxNi}, total ${res.total})`);
  console.log(`Movimentos: ${res.movimentos?.length ?? 0}`);
  if (res.novoMaxNi != null && res.movimentos?.length) {
    console.log(`Novo max previsto: ${res.novoMaxNi}`);
  }

  for (const m of res.movimentos ?? []) {
    const flags = [m.imp ? 'import' : 'legado', m.negociado ? 'NEGociado' : null].filter(Boolean).join(', ');
    console.log(
      `  ${m.de} → ${m.para}  id=${m.processoId}  ${m.unidade ?? '-'}  [${flags}]`
    );
  }

  const neg = res.negociadosRenumerados ?? res.movimentos?.filter((m) => m.negociado) ?? [];
  if (neg.length) {
    console.log(`\nAtenção: ${neg.length} processo(s) negociado(s) serão renumerados (não excluídos):`);
    for (const m of neg) {
      console.log(`  proc ${m.de} → ${m.para} (${m.unidade ?? '-'})`);
    }
  }

  if (opts.dryRun && res.movimentos?.length) {
    console.log(`\nSimulação concluída. Para aplicar:`);
    console.log(
      `  node scripts/compactar-lacunas-proc-cliente.mjs --cod=${opts.cod}${opts.vps ? ' --vps' : ''} --lacuna-min=${opts.lacunaMin} --confirmar=${opts.confirmarEsperado}\n`
    );
  } else if (!opts.dryRun) {
    console.log(`\nLacunas restantes: ${res.lacunasRestantes ?? '?'}`);
    console.log(`Max final: ${res.novoMaxNi ?? '?'}\n`);
  }
} finally {
  await conn.end();
}
