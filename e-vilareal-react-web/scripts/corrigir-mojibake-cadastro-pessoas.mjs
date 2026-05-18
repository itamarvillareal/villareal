#!/usr/bin/env node
/**
 * Corrige mojibake / acentuação no cadastro de pessoas (MySQL).
 * Usa a mesma lógica que {@code PortuguesTextoCorrecaoUtil} / {@code MojibakeUtf8DadosRepair} na API Java.
 *
 * Uso:
 *   node scripts/corrigir-mojibake-cadastro-pessoas.mjs --dry-run
 *   node scripts/corrigir-mojibake-cadastro-pessoas.mjs --aplicar
 *   VILAREAL_MYSQL_PORT=3308 node scripts/corrigir-mojibake-cadastro-pessoas.mjs --aplicar
 *
 * Alternativa Java (todo o schema, inclui processos):
 *   cd e-vilareal-java-backend && ./mvnw -q exec:java -Dexec.mainClass=br.com.vilareal.db.migration.RepairTextoDadosCli
 */
import process from 'node:process';

import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { corrigirMojibakeUtf8 } from './lib/utf8-mojibake-util.mjs';

const TABELAS = [
  { tabela: 'pessoa', idCol: 'id', colunas: ['nome', 'email', 'telefone'] },
  {
    tabela: 'pessoa_complementar',
    idCol: 'pessoa_id',
    colunas: ['rg', 'orgao_expedidor', 'profissao', 'nacionalidade', 'estado_civil', 'genero'],
  },
  { tabela: 'pessoa_endereco', idCol: 'id', colunas: ['rua', 'bairro', 'cidade', 'estado', 'cep'] },
  { tabela: 'pessoa_contato', idCol: 'id', colunas: ['tipo', 'valor', 'usuario_lancamento'] },
  {
    tabela: 'cliente',
    idCol: 'id',
    colunas: ['nome_referencia', 'documento_referencia', 'observacao'],
  },
];

function parseArgs(argv) {
  const aplicar = argv.includes('--aplicar');
  const dryRun = argv.includes('--dry-run') || !aplicar;
  const limiteLog = (() => {
    const a = argv.find((x) => x.startsWith('--limite-log='));
    return a ? Math.max(0, Number(a.slice(13)) || 50) : 50;
  })();
  return { dryRun, aplicar, limiteLog };
}

function normalizarCampo(v) {
  if (v == null) return null;
  const s = String(v);
  if (!s) return s;
  return corrigirMojibakeUtf8(s);
}

async function processarTabela(conn, spec, opts, stats) {
  const cols = spec.colunas.join(', ');
  const [rows] = await conn.query(`SELECT ${spec.idCol}, ${cols} FROM ${spec.tabela}`);
  let alterados = 0;

  for (const row of rows) {
    const id = row[spec.idCol];
    const corrigidos = {};
    let mudou = false;
    for (const col of spec.colunas) {
      const antes = row[col];
      const depois = antes == null ? null : normalizarCampo(antes);
      corrigidos[col] = depois;
      if (antes !== depois && !(antes == null && depois == null)) mudou = true;
    }
    if (!mudou) continue;

    alterados++;
    stats.total++;
    if (stats.amostras.length < opts.limiteLog) {
      const diff = {};
      for (const col of spec.colunas) {
        if (row[col] !== corrigidos[col]) diff[col] = { antes: row[col], depois: corrigidos[col] };
      }
      stats.amostras.push({ tabela: spec.tabela, id, diff });
    }

    if (!opts.dryRun) {
      const sets = spec.colunas.map((c) => `${c} = ?`).join(', ');
      const vals = spec.colunas.map((c) => corrigidos[c]);
      vals.push(id);
      await conn.query(`UPDATE ${spec.tabela} SET ${sets} WHERE ${spec.idCol} = ?`, vals);
    }
  }

  console.log(`  ${spec.tabela}: ${alterados} linha(s) ${opts.dryRun ? 'a corrigir' : 'corrigida(s)'}`);
  return alterados;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.dryRun && !opts.aplicar) {
    console.error('Use --dry-run ou --aplicar');
    process.exit(1);
  }

  const conn = await conectarMysqlVilareal();
  const stats = { total: 0, amostras: [] };

  try {
    console.log(
      opts.dryRun
        ? 'Modo simulação (--dry-run) — nenhum UPDATE\n'
        : 'Aplicando correções no MySQL…\n'
    );

    if (!opts.dryRun) await conn.beginTransaction();

    for (const spec of TABELAS) {
      await processarTabela(conn, spec, opts, stats);
    }

    if (!opts.dryRun) {
      await conn.commit();
      console.log('\nCommit OK.');
    }

    console.log(`\nTotal de registros com texto corrigido: ${stats.total}`);
    if (stats.amostras.length) {
      console.log(`\nAmostra (até ${opts.limiteLog}):`);
      for (const a of stats.amostras) {
        console.log(`\n[${a.tabela}] id=${a.id}`);
        for (const [col, { antes, depois }] of Object.entries(a.diff)) {
          console.log(`  ${col}: ${JSON.stringify(antes)} → ${JSON.stringify(depois)}`);
        }
      }
    }
  } catch (e) {
    if (!opts.dryRun) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
    }
    throw e;
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
