#!/usr/bin/env node
/**
 * Remove imóveis fora da planilha admin (nº 1–66): duplicados do import-real (0.89.1),
 * nº errado (911/938 = código cliente) e registos sem nº de planilha.
 *
 * Uso: node scripts/limpar-imoveis-fora-planilha.mjs [--dry-run]
 */
import { execSync } from 'node:child_process';

const MAX_NP = 66;
const dryRun = process.argv.includes('--dry-run');

function mysql(sql) {
  return execSync(`docker exec vilareal-db mysql -uroot -proot vilareal -N -e ${JSON.stringify(sql)}`, {
    encoding: 'utf8',
  }).trim();
}

const idsRuins = mysql(`
SELECT GROUP_CONCAT(id) FROM (
  SELECT i.id FROM imovel i
  WHERE i.numero_planilha IS NULL
     OR i.numero_planilha > ${MAX_NP}
     OR i.numero_planilha IN (911, 938)
  UNION
  SELECT i.id FROM imovel i
  INNER JOIN imovel b ON b.numero_planilha = i.numero_planilha
    AND b.numero_planilha BETWEEN 1 AND ${MAX_NP}
    AND b.id > i.id
    AND (b.unidade IS NOT NULL OR b.condominio IS NOT NULL)
  WHERE i.observacoes LIKE '%0.89.1%'
) t
`);

if (!idsRuins) {
  console.log('Nada a remover.');
  process.exit(0);
}

const lista = idsRuins.split(',').map(Number).filter((n) => n > 0);
console.log(`Remover ${lista.length} imóvel(is): ${lista.join(', ')}`);

if (dryRun) {
  console.log('--dry-run: nenhuma alteração.');
  process.exit(0);
}

const inList = lista.join(',');
for (const tbl of ['contrato_locacao', 'imovel_processo']) {
  try {
    mysql(`DELETE FROM ${tbl} WHERE imovel_id IN (${inList})`);
  } catch {
    /* vazio */
  }
}
mysql(`DELETE FROM imovel WHERE id IN (${inList})`);
console.log(`Feito. Restam ${mysql('SELECT COUNT(*) FROM imovel')} registo(s) em imovel.`);
