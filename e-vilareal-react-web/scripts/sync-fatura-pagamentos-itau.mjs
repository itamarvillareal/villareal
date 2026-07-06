#!/usr/bin/env node
/**
 * Pós-import PDF Itaú — limpeza, fechamento, mapeamento e vínculos banco↔AUTO-FAT.
 *
 * Uso:
 *   node scripts/sync-fatura-pagamentos-itau.mjs --base-url=http://localhost:8080
 *   node scripts/sync-fatura-pagamentos-itau.mjs --base-url=https://portal.villarealadvocacia.adv.br
 */
import './lib/load-vilareal-import-env.mjs';

const TOL_VALOR_MIN = 0.06;
const TOL_VALOR_PCT = 0.02;
const VISA_DIAS_ANTES = 3;
const VISA_DIAS_DEPOIS = 31;
const MC_DIAS_ANTES = 5;
const MC_DIAS_DEPOIS = 50;

function parseArgs(argv) {
  const out = {
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    dryRun: false,
    skipLimpar: false,
    skipFechamento: false,
    skipVinculos: false,
    skipMapeamento: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--skip-limpar') out.skipLimpar = true;
    else if (a === '--skip-fechamento') out.skipFechamento = true;
    else if (a === '--skip-vinculos') out.skipVinculos = true;
    else if (a === '--skip-mapeamento') out.skipMapeamento = true;
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
  }
  return out;
}

function tolValor(ref) {
  return Math.max(TOL_VALOR_MIN, Math.abs(Number(ref) || 0) * TOL_VALOR_PCT);
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

async function listarMapeamentos(token, baseUrl) {
  const res = await fetch(`${baseUrl}/api/financeiro/cartao-banco-mapeamento`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET mapeamento: ${res.status}`);
  return res.json();
}

async function atualizarMapeamento(token, baseUrl, id, body) {
  const res = await fetch(`${baseUrl}/api/financeiro/cartao-banco-mapeamento/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT mapeamento: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function ehAutoFatLegadoMc(l) {
  const num = String(l.numeroLancamento ?? '');
  if (!/^AUTO-FAT-/i.test(num)) return false;
  const comp = String(l.dataCompetencia ?? l.dataLancamento ?? '').slice(0, 10);
  if (!comp) return false;
  return Number(comp.slice(8, 10)) === 10;
}

function addDays(iso, delta) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function diasEntre(a, b) {
  return Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
}

function findBankDebit(debits, valor, venc, usedIds, diasAntes, diasDepois) {
  const min = addDays(venc, -diasAntes);
  const max = addDays(venc, diasDepois);
  const tol = tolValor(valor);
  let melhor = null;
  for (const d of debits) {
    if (usedIds.has(d.id)) continue;
    const dv = Math.abs(Number(d.valor));
    if (Math.abs(dv - valor) > tol) continue;
    const dt = String(d.dataLancamento ?? '').slice(0, 10);
    if (dt < min || dt > max) continue;
    const diff = Math.abs(dv - valor);
    if (!melhor || diff < melhor.diff) melhor = { d, diff };
  }
  return melhor?.d ?? null;
}

/** MC: débito ~dia 10 do mês seguinte ao vencimento 25. */
function findBankDebitMc(debits, valor, venc, usedIds) {
  return findBankDebit(debits, valor, venc, usedIds, MC_DIAS_ANTES, MC_DIAS_DEPOIS);
}

async function limparComprasLegadoMcDia10(opts, token, mc) {
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
    return mesesPdf25.has(comp.slice(0, 7));
  });
  console.log(`\n[1b] Compras legado MC (competência dia 10): ${candidatos.length}`);
  let removidos = 0;
  for (const l of candidatos) {
    if (opts.dryRun) {
      removidos += 1;
      continue;
    }
    if ((await deletarLancamentoCartao(token, opts.baseUrl, l.id)) === 204) removidos += 1;
  }
  console.log(`  → ${removidos} removido(s)`);
}

async function limparPlanilhaVisaJan25(opts, token, visa) {
  const lista = await listarLancamentosCartao(token, opts.baseUrl, visa.id);
  const candidatos = lista.filter(
    (l) =>
      String(l.origem) === 'PLANILHA' &&
      String(l.dataCompetencia ?? '').startsWith('2025-01') &&
      !/^AUTO-FAT-/i.test(String(l.numeroLancamento ?? '')),
  );
  console.log(`\n[1c] PLANILHA residual Visa jan/25: ${candidatos.length}`);
  let removidos = 0;
  for (const l of candidatos) {
    if (opts.dryRun) {
      removidos += 1;
      continue;
    }
    if ((await deletarLancamentoCartao(token, opts.baseUrl, l.id)) === 204) removidos += 1;
  }
  console.log(`  → ${removidos} removido(s)`);
}

async function limparAutoFatLegadoMc(opts, token, mc) {
  const fats = await listarLancamentosCartao(token, opts.baseUrl, mc.id, { fechamentoAutomatico: true });
  const legado = fats.filter(ehAutoFatLegadoMc);
  console.log(`\n[1] AUTO-FAT legado MC (venc dia 10): ${legado.length}`);
  let removidos = 0;
  for (const l of legado) {
    if (opts.dryRun) {
      removidos += 1;
      continue;
    }
    if ((await deletarLancamentoCartao(token, opts.baseUrl, l.id)) === 204) removidos += 1;
  }
  console.log(`  → ${removidos} removido(s)`);
}

async function corrigirMapeamentoMc(opts, token, mc) {
  const maps = await listarMapeamentos(token, opts.baseUrl);
  const regra = maps.find((m) => Number(m.cartaoId) === Number(mc.id));
  if (!regra) {
    console.log('\n[5] Mapeamento MC: regra não encontrada');
    return;
  }
  if (String(regra.padraoDescricao).toUpperCase().includes('CARTAO PERSONNALITE')) {
    console.log('\n[5] Mapeamento MC: já OK (CARTAO PERSONNALITE)');
    return;
  }
  const body = {
    cartaoId: regra.cartaoId,
    numeroBanco: regra.numeroBanco,
    padraoDescricao: 'CARTAO PERSONNALITE',
    tipoMatch: regra.tipoMatch || 'CONTAINS',
    toleranciaValor: Number(regra.toleranciaValor) || 0.05,
    toleranciaDias: Number(regra.toleranciaDias) || 31,
    ativo: regra.ativo !== false,
  };
  console.log('\n[5] Mapeamento MC: MASTERCARD BLACK → CARTAO PERSONNALITE');
  if (opts.dryRun) return;
  await atualizarMapeamento(token, opts.baseUrl, regra.id, body);
  console.log('  → atualizado id=' + regra.id);
}

async function vincularCartao(opts, token, cartao, debits, usedBanco, usedCartao, label, findFn, compFim) {
  const fats = await listarLancamentosCartao(token, opts.baseUrl, cartao.id, { fechamentoAutomatico: true });
  const autofats = fats
    .filter((f) => {
      const comp = String(f.dataCompetencia ?? '').slice(0, 10);
      return comp >= '2025-01-01' && comp <= compFim;
    })
    .filter((f) => !usedCartao.has(Number(f.id)))
    .sort((a, b) => String(a.dataCompetencia).localeCompare(String(b.dataCompetencia)));

  console.log(`\n[3] Vínculos ${label} (candidatos: ${autofats.length})`);
  let criados = 0;
  let pulados = 0;
  let erros = 0;

  for (const f of autofats) {
    const venc = String(f.dataCompetencia ?? '').slice(0, 10);
    const val = Math.abs(Number(f.valor));
    const banco = findFn(debits, val, venc, usedBanco);
    if (!banco) {
      pulados += 1;
      continue;
    }
    if (opts.dryRun) {
      usedBanco.add(banco.id);
      usedCartao.add(Number(f.id));
      criados += 1;
      console.log(`  [dry-run] ${venc} ${val.toFixed(2)} ↔ banco ${String(banco.dataLancamento).slice(0, 10)}`);
      continue;
    }
    try {
      await criarVinculo(token, opts.baseUrl, banco.id, f.id);
      usedBanco.add(banco.id);
      usedCartao.add(Number(f.id));
      console.log(
        `  OK ${venc} ${val.toFixed(2)} ↔ banco ${String(banco.dataLancamento).slice(0, 10)} (ids ${banco.id}/${f.id})`,
      );
      criados += 1;
    } catch (e) {
      console.log(`  ERRO ${venc}: ${e.message}`);
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
    await limparPlanilhaVisaJan25(opts, token, visa);
  }

  if (!opts.skipFechamento) {
    console.log('\n[2] fechamento-fatura/executar');
    if (!opts.dryRun) {
      const r = await executarFechamento(token, opts.baseUrl);
      console.log(`  → ${r.fechamentosProcessados ?? 0} fechamento(s) processado(s)`);
    }
  }

  if (!opts.skipMapeamento) await corrigirMapeamentoMc(opts, token, mc);

  if (!opts.skipVinculos) {
    const vinculos = await listarVinculos(token, opts.baseUrl);
    const usedBanco = new Set(vinculos.map((v) => Number(v.lancamentoBancoId)));
    const usedCartao = new Set(vinculos.map((v) => Number(v.lancamentoCartaoId)));
    const debits = await listarDebitosPersonnalite(token, opts.baseUrl);

    const findVisa = (d, v, ven, u) =>
      findBankDebit(d, v, ven, u, VISA_DIAS_ANTES, VISA_DIAS_DEPOIS);

    await vincularCartao(opts, token, visa, debits, usedBanco, usedCartao, 'Visa', findVisa, '2026-07-31');
    await vincularCartao(opts, token, mc, debits, usedBanco, usedCartao, 'MC Black', findBankDebitMc, '2026-06-30');

    const debRest = debits.filter((d) => !usedBanco.has(d.id));
    const mcFat = await listarLancamentosCartao(token, opts.baseUrl, mc.id, { fechamentoAutomatico: true });
    const mcPend = mcFat.filter((f) => !usedCartao.has(Number(f.id)) && String(f.dataCompetencia || '') >= '2025-01-01');
    if (debRest.length || mcPend.length) {
      console.log(`\n[!] Sem par automático: ${debRest.length} débito(s) banco, ${mcPend.length} AUTO-FAT MC`);
      for (const d of debRest) {
        console.log(`  banco ${String(d.dataLancamento).slice(0, 10)} ${Math.abs(Number(d.valor)).toFixed(2)} id=${d.id}`);
      }
    }
  }

  console.log('\nConcluído.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
