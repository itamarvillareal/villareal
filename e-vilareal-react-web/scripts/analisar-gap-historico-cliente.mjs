#!/usr/bin/env node
/**
 * Compara linhas de histórico na planilha (layout import-historico) com contagens na BD
 * para um código cliente (ex.: 728 → 00000728).
 *
 * Uso:
 *   node scripts/analisar-gap-historico-cliente.mjs "/caminho/Pasta2 - 728.xls" 728
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import XLSX from 'xlsx';

function normalizarCodigoCliente8(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim().replace(/\D/g, '');
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return String(n).padStart(8, '0');
}

function contarLinhasUsadasAteF(mat) {
  let max = 0;
  for (let i = 0; i < mat.length; i += 1) {
    const row = mat[i];
    if (!Array.isArray(row)) continue;
    for (let j = 0; j < 6; j += 1) {
      const v = row[j];
      if (v != null && String(v).trim() !== '') {
        max = Math.max(max, i + 1);
        break;
      }
    }
  }
  return max;
}

function resolverAba(wb) {
  const names = wb.SheetNames || [];
  if (names.includes('Planilha2')) return 'Planilha2';
  const pasta2 = names.find((n) => /pasta\s*2/i.test(String(n)));
  if (pasta2) return pasta2;
  return names[0] || '';
}

/**
 * @param {unknown[][]} mat
 * @param {string} cod8 alvo ex. 00000728
 * @returns {Map<number, number>} numeroInterno → linhas na planilha
 */
function contagensPorNumeroInterno(mat, cod8Alvo) {
  const totalLinhas = contarLinhasUsadasAteF(mat);
  const lim = totalLinhas > 0 ? totalLinhas : mat.length;
  /** @type {Map<number, number>} */
  const map = new Map();
  /** @type {string | null} */
  let lastCod8 = null;
  for (let i = 0; i < lim; i += 1) {
    const row = mat[i];
    if (!Array.isArray(row)) continue;
    const a = row[0];
    const b = row[1];
    const d = row[3];
    const e = row[4];
    const f = row[5];
    const vazio =
      (a == null || String(a).trim() === '') &&
      (b == null || String(b).trim() === '') &&
      (d == null || String(d).trim() === '') &&
      (e == null || String(e).trim() === '') &&
      (f == null || String(f).trim() === '');
    if (vazio) continue;

    let cod8 = normalizarCodigoCliente8(a);
    if (!cod8 && lastCod8) cod8 = lastCod8;
    if (cod8) lastCod8 = cod8;
    if (cod8 !== cod8Alvo) continue;

    const bStr = b == null || b === '' ? '' : String(b).trim();
    let ni = Number.parseInt(bStr, 10);
    if (!Number.isFinite(ni) || ni < 1) ni = 1;
    map.set(ni, (map.get(ni) || 0) + 1);
  }
  return map;
}

function carregarContagensBd(cod8Cliente) {
  const esc = String(cod8Cliente).replace(/'/g, "''");
  const sql = `SELECT p.numero_interno,COUNT(a.id) FROM cliente c JOIN processo p ON p.pessoa_id=c.pessoa_id LEFT JOIN processo_andamento a ON a.processo_id=p.id WHERE c.codigo_cliente='${esc}' GROUP BY p.numero_interno`;
  const out = execSync(
    `docker exec vilareal-db mysql -uroot -proot vilareal -N -e ${JSON.stringify(sql)}`,
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  /** @type {Map<number, number>} */
  const m = new Map();
  for (const line of out.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const [ni, n] = t.split('\t');
    const niN = Number(ni);
    const nN = Number(n);
    if (Number.isFinite(niN) && Number.isFinite(nN)) m.set(niN, nN);
  }
  return m;
}

const file = process.argv[2];
const codArg = process.argv[3] || '728';
if (!file || !fs.existsSync(file)) {
  console.error('Uso: node scripts/analisar-gap-historico-cliente.mjs "<ficheiro.xls>" [codigoCliente]');
  process.exit(1);
}
const cod8 = normalizarCodigoCliente8(codArg);
if (!cod8) {
  console.error('Código cliente inválido');
  process.exit(1);
}

const wb = XLSX.readFile(file);
const sheet = resolverAba(wb);
const mat = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null, raw: true });
const plan = contagensPorNumeroInterno(mat, cod8);

let bd;
try {
  bd = carregarContagensBd(cod8);
} catch (e) {
  console.error('Falha ao ler BD (docker vilareal-db).', e?.message || e);
  process.exit(1);
}

let totalPlan = 0;
for (const v of plan.values()) totalPlan += v;
let totalBd = 0;
for (const v of bd.values()) totalBd += v;

/** @type {{ ni: number; plan: number; bd: number; gap: number }[]} */
const gaps = [];
const nis = new Set([...plan.keys(), ...bd.keys()]);
for (const ni of nis) {
  const p = plan.get(ni) || 0;
  const b = bd.get(ni) || 0;
  if (p > b) gaps.push({ ni, plan: p, bd: b, gap: p - b });
}
gaps.sort((a, b) => b.gap - a.gap);

console.log(`Ficheiro: ${file}`);
console.log(`Aba: ${sheet}`);
console.log(`Cliente: ${cod8}`);
console.log(`Total linhas planilha (só este cliente): ${totalPlan}`);
console.log(`Total andamentos na BD (todos os processos deste cliente): ${totalBd}`);
console.log(`Diferença agregada (planilha − BD): ${totalPlan - totalBd}`);
console.log('');
console.log(`Processos com mais linhas na planilha do que andamentos na BD: ${gaps.length}`);
console.log('(Top 40 por gap — ni = nº interno do processo)');
for (const g of gaps.slice(0, 40)) {
  console.log(`  ni ${g.ni}: planilha=${g.plan} bd=${g.bd} falta≈${g.gap}`);
}
