#!/usr/bin/env node
/**
 * Passos operacionais pós-import PDF Itaú:
 * 1. Remove AUTO-FAT legado MC Black (vencimento dia 10 duplicado)
 * 2. Recalcula fechamentos (AUTO-FAT venc 25)
 * 3. Cria vínculos pagamento fatura — Visa (match valor + janela de data)
 *
 * Uso:
 *   node scripts/sync-fatura-pagamentos-itau.mjs --base-url=http://localhost:8080
 *   node scripts/sync-fatura-pagamentos-itau.mjs --base-url=https://portal.villarealadvocacia.adv.br
 *   node scripts/sync-fatura-pagamentos-itau.mjs --dry-run
 */
import './lib/load-vilareal-import-env.mjs';

const TOL_VALOR = 0.06;
const VISA_DIAS_ANTES = 3;
const VISA_DIAS_DEPOIS = 31;

function parseArgs(argv) {
  const out = {
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    dryRun: false,
    skipLimpar: false,
    skipFechamento: false,
    skipVinculos: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--skip-limpar') out.skipLimpar = true;
    else if (a === '--skip-fechamento') out.skipFechamento = true;
    else if (a === '--skip-vinculos') out.skipVinculos = true;
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
  if (!res.ok) throw new Error(`Login falhou ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  if (!j.accessToken) throw new Error('Login sem accessToken');
  return j.accessToken;
}

async function listarCartoes(token, baseUrl) {
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET cartoes: ${res.status}`);
  return res.json();
}

async function listarLancamentosCartao(token, baseUrl, cartaoId, params = {}) {
  const qs = new URLSearchParams({ cartaoId: String(cartaoId), ...params });
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes/lancamentos?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET lancamentos cartao: ${res.status}`);
  return res.json();
}

async function deletarLancamentoCartao(token, baseUrl, id) {
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes/lancamentos/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

/** Remove compras legado (PLANILHA etc.) com competência dia 10 quando o mês já tem FATURA_PDF no dia 25. */
async function limparComprasLegadoMcDia10(opts, token, mc, fats) {
  const lista = await listarLancamentosCartao(token, opts.baseUrl, mc.id);
  const mesesPdf25 = new Set(
    lista
      .filter((l) => String(l.origem) === 'FATURA_PDF')
      .map((l) => String(l.dataCompetencia ?? '').slice(0, 7))
      .filter((ym) => ym.length === 7),
  );
  const candidatos = lista.filter((l) => {
    if (/^AUTO-FAT-/i.test(String(l.numeroLancamento ?? ''))) return false;
    if (String(l.origem) === 'FATURA_PDF') return false;
    const comp = String(l.dataCompetencia ?? '').slice(0, 10);
    if (!comp || !comp.endsWith('-10')) return false;
    const ym = comp.slice(0, 7);
    return mesesPdf25.has(ym);
  });
  console.log(`\n[1b] Compras legado MC (competência dia 10, mês com PDF dia 25): ${candidatos.length}`);
  let removidos = 0;
  let erros = 0;
  for (const l of candidatos) {
    if (opts.dryRun) {
      console.log(`  [dry-run] DELETE compra id=${l.id} ${String(l.dataCompetencia).slice(0, 10)} ${l.origem}`);
      removidos += 1;
      continue;
    }
    const status = await deletarLancamentoCartao(token, opts.baseUrl, l.id);
    if (status === 204) removidos += 1;
    else erros += 1;
  }
  console.log(`  → ${removidos} removido(s), ${erros} erro(s)`);
  return { removidos, erros };
}

async function executarFechamento(token, baseUrl) {
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes/fechamento-fatura/executar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: '{}',
  });
  if (!res.ok) throw new Error(`fechamento-fatura: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function listarVinculos(token, baseUrl) {
  const res = await fetch(`${baseUrl}/api/financeiro/pagamentos-fatura/vinculos`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET vinculos: ${res.status}`);
  return res.json();
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

async function listarDebitosPersonnalite(token, baseUrl) {
  const out = [];
  let page = 0;
  while (true) {
    const qs = new URLSearchParams({
      page: String(page),
      size: '500',
      dataInicio: '2025-01-01',
      dataFim: '2026-12-31',
      numeroBanco: '1',
    });
    const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/paginada?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`GET lancamentos paginada: ${res.status}`);
    const pag = await res.json();
    for (const l of pag.content || []) {
      if (l.natureza !== 'DEBITO') continue;
      if (!/personnalite/i.test(String(l.descricao || ''))) continue;
      out.push(l);
    }
    if (pag.last) break;
    page += 1;
  }
  return out;
}

function ehAutoFatLegadoMc(l) {
  const num = String(l.numeroLancamento ?? '');
  if (!/^AUTO-FAT-/i.test(num)) return false;
  const comp = String(l.dataCompetencia ?? l.dataLancamento ?? '').slice(0, 10);
  if (!comp) return false;
  const day = Number(comp.slice(8, 10));
  return day === 10;
}

function addDays(iso, delta) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function findBankDebit(debits, valor, venc, usedIds) {
  const min = addDays(venc, -VISA_DIAS_ANTES);
  const max = addDays(venc, VISA_DIAS_DEPOIS);
  return debits.find((d) => {
    if (usedIds.has(d.id)) return false;
    if (Math.abs(Math.abs(Number(d.valor)) - valor) > TOL_VALOR) return false;
    const dt = String(d.dataLancamento ?? '').slice(0, 10);
    return dt >= min && dt <= max;
  });
}

async function limparAutoFatLegadoMc(opts, token, mc) {
  const fats = await listarLancamentosCartao(token, opts.baseUrl, mc.id, { fechamentoAutomatico: true });
  const legado = fats.filter(ehAutoFatLegadoMc);
  console.log(`\n[1] AUTO-FAT legado MC (venc dia 10): ${legado.length}`);
  let removidos = 0;
  let erros = 0;
  for (const l of legado.sort((a, b) => String(a.dataCompetencia).localeCompare(String(b.dataCompetencia)))) {
    const comp = String(l.dataCompetencia ?? '').slice(0, 10);
    const val = Math.abs(Number(l.valor)).toFixed(2);
    if (opts.dryRun) {
      console.log(`  [dry-run] DELETE id=${l.id} ${comp} ${val} ${l.numeroLancamento}`);
      removidos += 1;
      continue;
    }
    const status = await deletarLancamentoCartao(token, opts.baseUrl, l.id);
    if (status === 204) {
      console.log(`  removido id=${l.id} ${comp} ${val}`);
      removidos += 1;
    } else {
      console.log(`  ERRO id=${l.id} ${comp} HTTP ${status}`);
      erros += 1;
    }
  }
  console.log(`  → ${removidos} removido(s), ${erros} erro(s)`);
  return { removidos, erros };
}

async function recalcularFechamento(opts, token) {
  console.log('\n[2] fechamento-fatura/executar');
  if (opts.dryRun) {
    console.log('  [dry-run] skip');
    return { fechamentosProcessados: 0 };
  }
  const r = await executarFechamento(token, opts.baseUrl);
  console.log(`  → ${r.fechamentosProcessados ?? 0} fechamento(s) processado(s)`);
  return r;
}

async function vincularVisa(opts, token, visa) {
  const vinculos = await listarVinculos(token, opts.baseUrl);
  const cartoesVinculados = new Set(vinculos.map((v) => Number(v.lancamentoCartaoId)));
  const bancosVinculados = new Set(vinculos.map((v) => Number(v.lancamentoBancoId)));

  const fats = await listarLancamentosCartao(token, opts.baseUrl, visa.id, { fechamentoAutomatico: true });
  const autofats = fats
    .filter((f) => {
      const comp = String(f.dataCompetencia ?? '').slice(0, 10);
      return comp >= '2025-01-01' && comp <= '2026-06-30';
    })
    .filter((f) => !cartoesVinculados.has(Number(f.id)))
    .sort((a, b) => String(a.dataCompetencia).localeCompare(String(b.dataCompetencia)));

  const debits = await listarDebitosPersonnalite(token, opts.baseUrl);
  const usedBanco = new Set(bancosVinculados);

  console.log(`\n[3] Vínculos Visa (candidatos AUTO-FAT: ${autofats.length})`);
  let criados = 0;
  let pulados = 0;
  let erros = 0;

  for (const f of autofats) {
    const venc = String(f.dataCompetencia ?? '').slice(0, 10);
    const val = Math.abs(Number(f.valor));
    const banco = findBankDebit(debits, val, venc, usedBanco);
    if (!banco) {
      console.log(`  SKIP ${venc} ${val.toFixed(2)} — sem débito banco`);
      pulados += 1;
      continue;
    }
    if (opts.dryRun) {
      console.log(
        `  [dry-run] VINCULO banco=${banco.id} ${String(banco.dataLancamento).slice(0, 10)} ↔ cartão=${f.id} ${venc}`,
      );
      usedBanco.add(banco.id);
      criados += 1;
      continue;
    }
    try {
      await criarVinculo(token, opts.baseUrl, banco.id, f.id);
      usedBanco.add(banco.id);
      console.log(
        `  OK ${venc} ${val.toFixed(2)} ↔ banco ${String(banco.dataLancamento).slice(0, 10)} (ids ${banco.id}/${f.id})`,
      );
      criados += 1;
    } catch (e) {
      console.log(`  ERRO ${venc} ids ${banco.id}/${f.id}: ${e.message}`);
      erros += 1;
    }
  }
  console.log(`  → ${criados} vínculo(s), ${pulados} sem par, ${erros} erro(s)`);
  return { criados, pulados, erros };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`API: ${opts.baseUrl}${opts.dryRun ? ' [DRY-RUN]' : ''}`);

  const token = await login(opts);
  const cartoes = await listarCartoes(token, opts.baseUrl);
  const mc = cartoes.find((c) => c.nome === 'Mastercard Black');
  const visa = cartoes.find((c) => c.nome === 'Visa');
  if (!mc || !visa) throw new Error('Cartões Visa / Mastercard Black não encontrados');

  if (!opts.skipLimpar) {
    await limparComprasLegadoMcDia10(opts, token, mc);
    await limparAutoFatLegadoMc(opts, token, mc);
  }
  if (!opts.skipFechamento) await recalcularFechamento(opts, token);
  if (!opts.skipVinculos) await vincularVisa(opts, token, visa);

  console.log('\nConcluído.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
