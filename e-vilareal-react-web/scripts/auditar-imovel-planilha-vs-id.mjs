#!/usr/bin/env node
/**
 * Audita conflitos entre nº da planilha (col. A, 1–66) e id interno da API.
 * Uso local/VPS:
 *   node e-vilareal-react-web/scripts/auditar-imovel-planilha-vs-id.mjs
 *   node e-vilareal-react-web/scripts/auditar-imovel-planilha-vs-id.mjs --vps
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MAX_PLANILHA = 66;
const args = process.argv.slice(2);
const useVps = args.includes('--vps');

function runMysql(sql) {
  if (useVps) {
    const sshKey = process.env.VPS_SSH_KEY || `${process.env.HOME}/.ssh/villareal_vps`;
    const remote = `set -a && source /opt/villareal/villareal/.env.docker && set +a && mysql -h127.0.0.1 -u"\${VILLAREAL_COMPOSE_JDBC_USER}" -p"\${VILLAREAL_COMPOSE_JDBC_PASSWORD}" vilareal -N -e ${JSON.stringify(sql)}`;
    const r = spawnSync('ssh', ['-i', sshKey, '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', 'root@161.97.175.73', 'bash', '-lc', remote], {
      encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error(r.stderr || r.stdout || 'SSH/MySQL falhou');
    return r.stdout.trim();
  }
  throw new Error('Auditoria local exige --vps (MySQL de produção).');
}

function parseRows(raw) {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [id, np, situacao, unidade] = l.split('\t');
      return {
        id: Number(id),
        numeroPlanilha: Number(np),
        situacao: String(situacao ?? ''),
        unidade: String(unidade ?? ''),
      };
    });
}

const raw = runMysql(
  `SELECT i.id, i.numero_planilha, i.situacao, IFNULL(i.unidade,'') FROM imovel i WHERE i.ativo=1 AND i.numero_planilha BETWEEN 1 AND ${MAX_PLANILHA} ORDER BY i.numero_planilha, i.id`,
);

const rows = parseRows(raw).filter((r) => Number.isFinite(r.numeroPlanilha) && r.numeroPlanilha >= 1);
const porPlanilha = new Map();
for (const r of rows) {
  if (!porPlanilha.has(r.numeroPlanilha)) porPlanilha.set(r.numeroPlanilha, []);
  porPlanilha.get(r.numeroPlanilha).push(r);
}

const conflitosId = rows.filter((r) => r.id !== r.numeroPlanilha);
const duplicatas = [...porPlanilha.entries()].filter(([, list]) => list.length > 1);
const armadilhas = [];

for (let np = 1; np <= MAX_PLANILHA; np += 1) {
  const candidatos = porPlanilha.get(np) || [];
  const idInterno = rows.find((r) => r.id === np);
  if (!idInterno) continue;
  const melhorPlanilha = candidatos.sort((a, b) => score(b) - score(a))[0];
  if (!melhorPlanilha) continue;
  if (melhorPlanilha.id !== idInterno.id) {
    armadilhas.push({
      parametro: np,
      seConfundirComIdInterno: `${idInterno.unidade || '—'} (${idInterno.situacao})`,
      cadastroCorretoPlanilha: `${melhorPlanilha.unidade || '—'} (${melhorPlanilha.situacao}) id=${melhorPlanilha.id}`,
    });
  }
}

function score(r) {
  let s = 0;
  if (r.unidade) s += 4;
  if (r.situacao === 'OCUPADO') s += 1;
  return s;
}

console.log('=== Auditoria imóvel: planilha (col. A) × id interno ===');
console.log(`Registos ativos com planilha 1–${MAX_PLANILHA}: ${rows.length}`);
console.log(`Id interno ≠ nº planilha: ${conflitosId.length} (esperado após import)`);
console.log(`Nº planilha duplicado: ${duplicatas.length}`);
if (duplicatas.length) {
  for (const [np, list] of duplicatas) {
    console.log(`  planilha ${np}: ids ${list.map((x) => x.id).join(', ')}`);
  }
}
console.log(`Parâmetros 1–${MAX_PLANILHA} ambíguos (GET /api/imoveis/{n} ≠ planilha n): ${armadilhas.length}`);
for (const a of armadilhas.slice(0, 20)) {
  console.log(`  n=${a.parametro}: id→ ${a.seConfundirComIdInterno} | planilha→ ${a.cadastroCorretoPlanilha}`);
}
if (armadilhas.length > 20) console.log(`  … +${armadilhas.length - 20} casos`);
console.log('\nRegra UI: cadastro/relatório usam nº planilha; IPTU/Drive/API usam id interno (_apiImovelId).');
