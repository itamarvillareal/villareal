#!/usr/bin/env node
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';

const outFile = process.argv[2] || 'tmp/processos-sem-historico.pairs';
const conn = await conectarMysqlVilareal();

const [stats] = await conn.query(
  `SELECT
     (SELECT COUNT(*) FROM processo) AS processos,
     (SELECT COUNT(DISTINCT processo_id) FROM processo_andamento) AS comAndamento,
     (SELECT COUNT(*) FROM processo_andamento) AS totalAndamentos`
);
const [rows] = await conn.query(
  `SELECT CAST(TRIM(LEADING '0' FROM c.codigo_cliente) AS UNSIGNED) AS cliente, p.numero_interno AS proc
   FROM processo p
   INNER JOIN cliente c ON c.id = p.cliente_id
   WHERE NOT EXISTS (SELECT 1 FROM processo_andamento pa WHERE pa.processo_id = p.id)
   ORDER BY cliente, proc`
);
await conn.end();

const fs = await import('node:fs');
const lines = rows.map((r) => `${Number(r.cliente)} ${Number(r.proc)}`);
fs.mkdirSync('tmp', { recursive: true });
fs.writeFileSync(outFile, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');

console.log('Stats:', stats[0]);
console.log(`Processos sem histórico: ${lines.length}`);
console.log(`Lista: ${outFile}`);
