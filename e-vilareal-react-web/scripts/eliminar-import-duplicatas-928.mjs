#!/usr/bin/env node
/**
 * Remove os 49 processos duplicados da importação 01/07/2026 (cliente 928).
 * Migra whatsapp_cobrancas para o processo legado antes de excluir.
 *
 *   node scripts/eliminar-import-duplicatas-928.mjs --vps
 *   node scripts/eliminar-import-duplicatas-928.mjs --vps --confirmar=EXCLUIR-DUP-928
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';
import { aplicarPerfilConexao, parseFlagVps } from './lib/mysql-alvo-vilareal.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { excluirProcessosPorIds } from './lib/processo-exclusao-mysql.mjs';

const CONFIRMAR = 'EXCLUIR-DUP-928';
const COD8 = '00000928';
const CLIENTE_ID = 928;

/** proc importado → proc legado a manter */
const PARES = [
  [203, 41],
  [204, 148],
  [206, 43],
  [207, 44],
  [208, 24],
  [209, 45],
  [210, 46],
  [211, 47],
  [216, 188],
  [218, 189],
  [219, 99],
  [220, 30],
  [222, 3],
  [223, 100],
  [225, 54],
  [227, 5],
  [228, 56],
  [230, 199],
  [232, 60],
  [234, 143],
  [235, 154],
  [236, 61],
  [239, 137],
  [240, 67],
  [241, 112],
  [244, 182],
  [245, 72],
  [246, 164],
  [247, 76],
  [249, 15],
  [250, 16],
  [251, 36],
  [252, 169],
  [254, 159],
  [255, 160],
  [257, 132],
  [260, 87],
  [261, 88],
  [263, 108],
  [264, 20],
  [267, 167],
  [268, 170],
  [269, 92],
  [272, 38],
  [274, 33],
  [275, 172],
  [276, 184],
  [277, 98],
  [278, 22],
];

function parseArgs(argv) {
  const confirmar = argv.find((a) => a.startsWith('--confirmar='))?.slice(12) ?? null;
  return {
    dryRun: confirmar !== CONFIRMAR,
    confirmar,
    vps: parseFlagVps(argv),
  };
}

const opts = parseArgs(process.argv.slice(2));
const perfil = aplicarPerfilConexao({ vps: opts.vps });

console.log('\n=== Eliminar duplicatas importação 928 ===');
console.log(`Alvo: ${perfil.alvo}`);
console.log(`Modo: ${opts.dryRun ? 'simulação' : 'APLICAR exclusão'}`);
console.log(`Pares: ${PARES.length}\n`);

const conn = await conectarMysqlVilareal();

/** @type {{ elimProc: number, manterProc: number, elimId: number, manterId: number }[]} */
const resolvidos = [];

try {
  for (const [elimProc, manterProc] of PARES) {
    const [rows] = await conn.query(
      `SELECT id, numero_interno, importacao_id IS NOT NULL AS imp
       FROM processo WHERE cliente_id = ? AND numero_interno IN (?, ?)`,
      [CLIENTE_ID, elimProc, manterProc]
    );
    const elim = rows.find((r) => Number(r.numero_interno) === elimProc);
    const manter = rows.find((r) => Number(r.numero_interno) === manterProc);
    if (!elim?.id) {
      console.warn(`[pulado] proc ${elimProc} não encontrado`);
      continue;
    }
    if (!manter?.id) {
      throw new Error(`Processo legado ${manterProc} não encontrado (par ${elimProc})`);
    }
    if (!elim.imp) {
      throw new Error(`Proc ${elimProc} não é importado — abortando por segurança`);
    }
    const [negRows] = await conn.query(
      `SELECT COUNT(*) AS n FROM calculo_rodada
       WHERE TRIM(codigo_cliente) = ? AND numero_processo = ? AND parcelamento_aceito = 1`,
      [COD8, elimProc]
    );
    const negociado = Number(negRows[0]?.n ?? 0) > 0;
    if (negociado) {
      console.warn(
        `[pulado] proc ${elimProc} já negociado (parcelamento_aceito) — não pode ser excluído; unificar manualmente`
      );
      continue;
    }
    resolvidos.push({
      elimProc,
      manterProc,
      elimId: Number(elim.id),
      manterId: Number(manter.id),
    });
  }

  let cobrancasMigradas = 0;
  let rodadasRemovidas = 0;

  for (const par of resolvidos) {
    const [cob] = await conn.query(
      'SELECT COUNT(*) AS n FROM whatsapp_cobrancas WHERE processo_id = ?',
      [par.elimId]
    );
    const nCob = Number(cob[0]?.n ?? 0);
    if (nCob > 0) {
      console.log(`  proc ${par.elimProc}: ${nCob} cobrança(s) WhatsApp → proc ${par.manterProc}`);
      if (!opts.dryRun) {
        await conn.query('UPDATE whatsapp_cobrancas SET processo_id = ? WHERE processo_id = ?', [
          par.manterId,
          par.elimId,
        ]);
      }
      cobrancasMigradas += nCob;
    }

    const [rodadasElim] = await conn.query(
      'SELECT id, dimensao FROM calculo_rodada WHERE TRIM(codigo_cliente) = ? AND numero_processo = ?',
      [COD8, par.elimProc]
    );
    for (const rod of rodadasElim) {
      const [rodManter] = await conn.query(
        'SELECT id FROM calculo_rodada WHERE TRIM(codigo_cliente) = ? AND numero_processo = ? AND dimensao = ?',
        [COD8, par.manterProc, rod.dimensao]
      );
      if (rodManter.length > 0) {
        console.log(
          `  proc ${par.elimProc}: rodada dim ${rod.dimensao} já existe em ${par.manterProc} — remove duplicata`
        );
        if (!opts.dryRun) {
          await conn.query('DELETE FROM calculo_rodada WHERE id = ?', [rod.id]);
        }
        rodadasRemovidas += 1;
      } else {
        console.log(`  proc ${par.elimProc}: move rodada dim ${rod.dimensao} → proc ${par.manterProc}`);
        if (!opts.dryRun) {
          await conn.query(
            'UPDATE calculo_rodada SET numero_processo = ? WHERE id = ?',
            [par.manterProc, rod.id]
          );
        }
      }
    }
  }

  const processosExcluir = resolvidos.map((p) => ({
    id: p.elimId,
    codigoCliente: COD8,
    numeroInterno: p.elimProc,
  }));

  console.log('\n--- Resumo pré-exclusão ---');
  console.log(`Processos a excluir: ${processosExcluir.length}`);
  console.log(`Cobranças migradas:  ${cobrancasMigradas}`);
  console.log(`Rodadas removidas:   ${rodadasRemovidas}`);

  if (opts.dryRun) {
    console.log('\nSimulação concluída. Para aplicar:');
    console.log(`  node scripts/eliminar-import-duplicatas-928.mjs --vps --confirmar=${CONFIRMAR}\n`);
  } else {
    const { excluidos } = await excluirProcessosPorIds(conn, processosExcluir);
    console.log(`\nExcluídos: ${excluidos} processo(s)`);

    const [check] = await conn.query(
      `SELECT COUNT(*) AS n FROM processo WHERE cliente_id = ? AND numero_interno IN (${PARES.map(() => '?').join(',')})`,
      [CLIENTE_ID, ...PARES.map(([e]) => e)]
    );
    const restantes = Number(check[0]?.n ?? 0);
    if (restantes !== 0) {
      throw new Error(`Ainda restam ${restantes} processos importados na lista`);
    }
    console.log('Verificação OK: nenhum dos 49 procs importados resta na base.');
    console.log(
      '\nPróximo passo: preencher lacunas com o último proc ativo:\n' +
        `  node scripts/compactar-lacunas-proc-cliente.mjs --vps --cod=928 --lacuna-min=203 --confirmar=COMPACTAR-928\n`
    );
  }
} finally {
  await conn.end();
}

if (!opts.dryRun) {
  process.exitCode = 0;
}
