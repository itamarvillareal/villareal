#!/usr/bin/env node
/**
 * Vincula débitos MC (~dia 10) ↔ AUTO-FAT PDF quando valores divergem (era planilha).
 * Requer backend com ignorarToleranciaValor no POST /api/financeiro/pagamentos-fatura/vinculos.
 *
 * Uso:
 *   node scripts/vincular-mc-pagamentos-forcado.mjs --base-url=https://portal.villarealadvocacia.adv.br
 *   node scripts/vincular-mc-pagamentos-forcado.mjs --dry-run
 */
import './lib/load-vilareal-import-env.mjs';

/** Pareamento cronológico: débito ~dia 10 → fatura MC vencimento 25 mês anterior. */
const PARES_MC = [
  { ciclo: 'fev/25', lancamentoBancoId: 270302, lancamentoCartaoId: 17689 },
  { ciclo: 'mar/25', lancamentoBancoId: 270781, lancamentoCartaoId: 17690 },
  { ciclo: 'abr/25', lancamentoBancoId: 271236, lancamentoCartaoId: 17691 },
  { ciclo: 'mai/25', lancamentoBancoId: 271589, lancamentoCartaoId: 17692 },
  { ciclo: 'jun/25', lancamentoBancoId: 271962, lancamentoCartaoId: 17693 },
  { ciclo: 'jul/25', lancamentoBancoId: 272333, lancamentoCartaoId: 17694 },
  { ciclo: 'ago/25', lancamentoBancoId: 272673, lancamentoCartaoId: 17695 },
  { ciclo: 'set/25', lancamentoBancoId: 273117, lancamentoCartaoId: 18450 },
  { ciclo: 'out/25', lancamentoBancoId: 273428, lancamentoCartaoId: 18471 },
  { ciclo: 'nov/25', lancamentoBancoId: 273890, lancamentoCartaoId: 18487 },
  { ciclo: 'jan/26', lancamentoBancoId: 274723, lancamentoCartaoId: 18517 },
];

function parseArgs(argv) {
  const out = {
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    dryRun: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
  }
  return out;
}

async function login(opts) {
  const res = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: String(opts.login).trim().toLowerCase(), senha: opts.senha }),
  });
  if (!res.ok) throw new Error(`Login falhou ${res.status}`);
  const j = await res.json();
  if (!j.accessToken) throw new Error('Login sem accessToken');
  return j.accessToken;
}

async function listarVinculos(token, baseUrl) {
  const res = await fetch(`${baseUrl}/api/financeiro/pagamentos-fatura/vinculos`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET vinculos: ${res.status}`);
  return res.json();
}

async function criarVinculoForcado(token, baseUrl, lancamentoBancoId, lancamentoCartaoId) {
  const res = await fetch(`${baseUrl}/api/financeiro/pagamentos-fatura/vinculos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ lancamentoBancoId, lancamentoCartaoId, ignorarToleranciaValor: true }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status}: ${txt.slice(0, 400)}`);
  }
  return res.json();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`API: ${opts.baseUrl}${opts.dryRun ? ' [DRY-RUN]' : ''}`);

  const token = await login(opts);
  const vinculos = await listarVinculos(token, opts.baseUrl);
  const usedBanco = new Set(vinculos.map((v) => Number(v.lancamentoBancoId)));
  const usedCartao = new Set(vinculos.map((v) => Number(v.lancamentoCartaoId)));

  let criados = 0;
  let pulados = 0;
  let erros = 0;

  for (const par of PARES_MC) {
    const { ciclo, lancamentoBancoId, lancamentoCartaoId } = par;
    if (usedBanco.has(lancamentoBancoId) || usedCartao.has(lancamentoCartaoId)) {
      console.log(`  SKIP ${ciclo} — já vinculado (banco ${lancamentoBancoId} / cartão ${lancamentoCartaoId})`);
      pulados += 1;
      continue;
    }
    if (opts.dryRun) {
      console.log(`  [dry-run] ${ciclo} banco ${lancamentoBancoId} ↔ cartão ${lancamentoCartaoId}`);
      criados += 1;
      continue;
    }
    try {
      const r = await criarVinculoForcado(token, opts.baseUrl, lancamentoBancoId, lancamentoCartaoId);
      usedBanco.add(lancamentoBancoId);
      usedCartao.add(lancamentoCartaoId);
      console.log(
        `  OK ${ciclo} banco ${lancamentoBancoId} (${Math.abs(Number(r.valorBanco)).toFixed(2)}) ↔ cartão ${lancamentoCartaoId} (${Math.abs(Number(r.valorCartao)).toFixed(2)})`,
      );
      criados += 1;
    } catch (e) {
      console.log(`  ERRO ${ciclo}: ${e.message}`);
      erros += 1;
    }
  }

  console.log(`\n→ ${criados} vínculo(s), ${pulados} já existente(s), ${erros} erro(s)`);
  if (erros > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
