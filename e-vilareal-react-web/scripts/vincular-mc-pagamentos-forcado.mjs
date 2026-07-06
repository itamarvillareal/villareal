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
  { ciclo: 'jan/25', lancamentoBancoId: 269937, vencimento: '2025-01-25' },
  { ciclo: 'fev/25', lancamentoBancoId: 270302, vencimento: '2025-02-25' },
  { ciclo: 'mar/25', lancamentoBancoId: 270781, vencimento: '2025-03-25' },
  { ciclo: 'abr/25', lancamentoBancoId: 271236, vencimento: '2025-04-25' },
  { ciclo: 'mai/25', lancamentoBancoId: 271589, vencimento: '2025-05-25' },
  { ciclo: 'jun/25', lancamentoBancoId: 271962, vencimento: '2025-06-25' },
  { ciclo: 'jul/25', lancamentoBancoId: 272333, vencimento: '2025-07-25' },
  { ciclo: 'ago/25', lancamentoBancoId: 272673, vencimento: '2025-08-25' },
  { ciclo: 'set/25', lancamentoBancoId: 273117, vencimento: '2025-09-25' },
  { ciclo: 'out/25', lancamentoBancoId: 273428, vencimento: '2025-10-25' },
  { ciclo: 'nov/25', lancamentoBancoId: 273890, vencimento: '2025-11-25' },
  { ciclo: 'dez/25', lancamentoBancoId: 274233, vencimento: '2025-12-25' },
  { ciclo: 'jan/26', lancamentoBancoId: 274723, vencimento: '2026-01-25' },
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

async function listarAutoFatPorVencimento(token, baseUrl, cartaoId) {
  const res = await fetch(
    `${baseUrl}/api/financeiro/cartoes/lancamentos?cartaoId=${cartaoId}&fechamentoAutomatico=true`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`GET AUTO-FAT: ${res.status}`);
  const fats = await res.json();
  const map = new Map();
  for (const f of fats) {
    const venc = String(f.dataCompetencia ?? '').slice(0, 10);
    if (venc) map.set(venc, f);
  }
  return map;
}

async function criarVinculo(token, baseUrl, lancamentoBancoId, lancamentoCartaoId) {
  const res = await fetch(`${baseUrl}/api/financeiro/pagamentos-fatura/vinculos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ lancamentoBancoId, lancamentoCartaoId }),
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

  const cartoes = await (await fetch(`${opts.baseUrl}/api/financeiro/cartoes`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })).json();
  const mc = cartoes.find((c) => c.nome === 'Mastercard Black');
  if (!mc) throw new Error('Cartão Mastercard Black não encontrado');
  const autoPorVenc = await listarAutoFatPorVencimento(token, opts.baseUrl, mc.id);

  let criados = 0;
  let pulados = 0;
  let erros = 0;

  for (const par of PARES_MC) {
    const { ciclo, lancamentoBancoId, vencimento } = par;
    const auto = autoPorVenc.get(vencimento);
    const lancamentoCartaoId = auto ? Number(auto.id) : null;
    if (!lancamentoCartaoId) {
      console.log(`  SKIP ${ciclo} — AUTO-FAT não encontrado (${vencimento})`);
      pulados += 1;
      continue;
    }
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
      const r = await criarVinculo(token, opts.baseUrl, lancamentoBancoId, lancamentoCartaoId);
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
