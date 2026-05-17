#!/usr/bin/env node
/** Valida grupos de compensação na API: pares com soma ≠ 0. */

import './lib/load-vilareal-import-env.mjs';
import { buildContaNomeParaLetra } from './lib/financeiro-api-conta-map.mjs';

const base = (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
const senha = process.env.VILAREAL_IMPORT_SENHA || '123456';

const { accessToken } = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'itamar', senha }),
}).then((r) => r.json());

const [contas, lancs] = await Promise.all([
  fetch(`${base}/api/financeiro/contas`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((r) => r.json()),
  fetch(`${base}/api/financeiro/lancamentos`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((r) => r.json()),
]);

const contaLetra = buildContaNomeParaLetra(contas);
const porGrupo = new Map();

for (const l of lancs || []) {
  if (contaLetra[l.contaContabilNome] !== 'E') continue;
  const g = String(l.grupoCompensacao ?? '').trim();
  if (!g) continue;
  const sinal = String(l.natureza ?? '').toUpperCase() === 'DEBITO' ? -1 : 1;
  const v = Number(l.valor) * sinal;
  if (!porGrupo.has(g)) porGrupo.set(g, []);
  porGrupo.get(g).push({ banco: l.bancoNome, data: l.dataLancamento, valor: v, desc: l.descricao });
}

let gruposOk = 0;
let gruposRuim = 0;
const amostraRuim = [];

for (const [g, items] of porGrupo) {
  const soma = items.reduce((s, x) => s + x.valor, 0);
  if (Math.abs(soma) < 0.02 && items.length >= 2) gruposOk += 1;
  else if (items.length >= 2) {
    gruposRuim += 1;
    if (amostraRuim.length < 5) amostraRuim.push({ g, soma, n: items.length, items: items.slice(0, 3) });
  }
}

const comGrupo = [...porGrupo.values()].reduce((s, a) => s + a.length, 0);
const eTotal = (lancs || []).filter((l) => contaLetra[l.contaContabilNome] === 'E').length;

console.log('\n=== Grupos compensação na API ===');
console.log(`Lançamentos E: ${eTotal}`);
console.log(`Com grupo_compensacao: ${comGrupo}`);
console.log(`Grupos distintos: ${porGrupo.size}`);
console.log(`Grupos ≥2 lanç. soma≈0: ${gruposOk}`);
console.log(`Grupos ≥2 lanç. soma≠0: ${gruposRuim}`);
for (const a of amostraRuim) {
  console.log(`  grupo ${a.g} soma=${a.soma.toFixed(2)} n=${a.n}`, a.items);
}
