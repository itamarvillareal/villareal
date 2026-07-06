#!/usr/bin/env node
/**
 * Alinha AUTO-FAT ao valor do débito bancário (exato) via linha AJUSTE-PAG no ciclo.
 * Remove vínculo divergente → insere/atualiza ajuste → recalcula fechamento → revincula.
 *
 * Uso:
 *   node scripts/alinhar-fatura-pagamento-exato.mjs --cartao="Mastercard Black" --base-url=https://portal.villarealadvocacia.adv.br
 *   node scripts/alinhar-fatura-pagamento-exato.mjs --dry-run
 */
import './lib/load-vilareal-import-env.mjs';

const EPS = 0.005;
const PREFIXO_AJUSTE = 'AJUSTE-PAG-';

function parseArgs(argv) {
  const out = {
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    cartao: 'Mastercard Black',
    dryRun: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--cartao=')) out.cartao = a.slice(9).trim();
  }
  return out;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function numeroAjuste(cartaoId, venc) {
  return `${PREFIXO_AJUSTE}${cartaoId}-${venc}`;
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

async function listarLancamentosCartao(token, baseUrl, cartaoId, { fechamentoAutomatico = false } = {}) {
  const qs = new URLSearchParams({ cartaoId: String(cartaoId) });
  if (fechamentoAutomatico) qs.set('fechamentoAutomatico', 'true');
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes/lancamentos?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET lancamentos: ${res.status}`);
  return res.json();
}

async function listarContas(token, baseUrl) {
  const res = await fetch(`${baseUrl}/api/financeiro/contas`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET contas: ${res.status}`);
  return res.json();
}

async function removerVinculo(token, baseUrl, id) {
  const res = await fetch(`${baseUrl}/api/financeiro/pagamentos-fatura/vinculos/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 204) throw new Error(`DELETE vinculo ${id}: ${res.status}`);
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
  if (!res.ok) throw new Error(`POST vinculo: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function upsertAjuste(token, baseUrl, { cartaoId, contaNId, venc, valorAjuste, existente }) {
  const body = {
    cartaoId,
    contaContabilId: contaNId,
    numeroLancamento: numeroAjuste(cartaoId, venc),
    dataLancamento: venc,
    dataCompetencia: venc,
    descricao: 'Ajuste pagamento banco × fatura PDF',
    descricaoDetalhada:
      `Diferença entre total PDF e débito bancário efetivo (R$ ${valorAjuste.toFixed(2)}). Compras PDF preservadas.`,
    valor: valorAjuste,
    refTipo: 'N',
    origem: 'AJUSTE_PAGAMENTO',
    status: 'ATIVO',
  };
  if (existente) {
    const res = await fetch(`${baseUrl}/api/financeiro/cartoes/lancamentos/${existente.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PUT ajuste: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return existente.id;
  }
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes/lancamentos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ajuste: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j.id;
}

async function deletarAjuste(token, baseUrl, id) {
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes/lancamentos/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 204) throw new Error(`DELETE ajuste ${id}: ${res.status}`);
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
  if (!res.ok) throw new Error(`fechamento: ${res.status}`);
  return res.json();
}

function somaCicloSemAutoFatAjuste(lista, venc, cartaoId) {
  let s = 0;
  for (const l of lista) {
    const comp = String(l.dataCompetencia ?? '').slice(0, 10);
    if (comp !== venc) continue;
    const num = String(l.numeroLancamento ?? '');
    if (/^AUTO-FAT-/i.test(num)) continue;
    if (num.startsWith(PREFIXO_AJUSTE)) continue;
    s += Number(l.valor) || 0;
  }
  return round2(s);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`API: ${opts.baseUrl} · cartão: ${opts.cartao}${opts.dryRun ? ' [DRY-RUN]' : ''}`);

  const token = await login(opts);
  const cartoes = await (await fetch(`${opts.baseUrl}/api/financeiro/cartoes`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })).json();
  const cartao = cartoes.find((c) => c.nome === opts.cartao);
  if (!cartao) throw new Error(`Cartão não encontrado: ${opts.cartao}`);

  const contas = await listarContas(token, opts.baseUrl);
  const contaN = contas.find((c) => String(c.codigo).toUpperCase() === 'N');
  if (!contaN) throw new Error('Conta contábil N não encontrada');

  const vinculos = await listarVinculos(token, opts.baseUrl);
  const doCartao = vinculos.filter((v) => String(v.cartaoNome) === opts.cartao);

  const lista = await listarLancamentosCartao(token, opts.baseUrl, cartao.id);
  const autofatById = new Map(
    lista.filter((l) => /^AUTO-FAT-/i.test(String(l.numeroLancamento ?? ''))).map((l) => [Number(l.id), l]),
  );

  const divergentes = [];
  for (const v of doCartao) {
    const banco = round2(Math.abs(Number(v.valorBanco)));
    const fat = round2(Math.abs(Number(v.valorCartao)));
    if (Math.abs(banco - fat) > EPS) {
      const auto = autofatById.get(Number(v.lancamentoCartaoId));
      divergentes.push({
        vinculo: v,
        banco,
        fat,
        diff: round2(banco - fat),
        venc: String(auto?.dataCompetencia ?? v.dataCartao ?? '').slice(0, 10),
      });
    }
  }

  console.log(`Vínculos ${opts.cartao}: ${doCartao.length} total, ${divergentes.length} com divergência`);
  if (!divergentes.length) {
    console.log('Nada a ajustar.');
    return;
  }

  let ok = 0;
  let erros = 0;

  for (const d of divergentes.sort((a, b) => a.venc.localeCompare(b.venc))) {
    const { vinculo, banco, fat, diff, venc } = d;
    if (!venc) {
      console.log(`  SKIP vinculo ${vinculo.id} — vencimento desconhecido`);
      erros += 1;
      continue;
    }

    const pdfSoma = somaCicloSemAutoFatAjuste(lista, venc, cartao.id);
    const valorAjuste = round2(banco - pdfSoma);
    const numAjuste = numeroAjuste(cartao.id, venc);
    const ajusteExistente = lista.find((l) => String(l.numeroLancamento) === numAjuste);

    console.log(
      `\n${venc} · banco ${banco.toFixed(2)} · AUTO-FAT ${fat.toFixed(2)} (Δ ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}) · PDF ${pdfSoma.toFixed(2)} → ajuste ${valorAjuste.toFixed(2)}`,
    );

    if (Math.abs(valorAjuste) <= EPS) {
      console.log('  ajuste ~0 — só recalcular fechamento');
    }

    if (opts.dryRun) {
      ok += 1;
      continue;
    }

    try {
      await removerVinculo(token, opts.baseUrl, vinculo.id);

      if (Math.abs(valorAjuste) <= EPS) {
        if (ajusteExistente) await deletarAjuste(token, opts.baseUrl, ajusteExistente.id);
      } else {
        await upsertAjuste(token, opts.baseUrl, {
          cartaoId: cartao.id,
          contaNId: contaN.id,
          venc,
          valorAjuste,
          existente: ajusteExistente,
        });
      }

      await executarFechamento(token, opts.baseUrl);

      const lista2 = await listarLancamentosCartao(token, opts.baseUrl, cartao.id, {
        fechamentoAutomatico: true,
      });
      const auto = lista2.find(
        (l) =>
          /^AUTO-FAT-/i.test(String(l.numeroLancamento ?? '')) &&
          String(l.dataCompetencia ?? '').slice(0, 10) === venc,
      );
      if (!auto) throw new Error('AUTO-FAT não encontrado após fechamento');
      const novoFat = round2(Math.abs(Number(auto.valor)));
      if (Math.abs(novoFat - banco) > EPS) {
        throw new Error(`AUTO-FAT ${novoFat} ainda ≠ banco ${banco}`);
      }

      await criarVinculo(token, opts.baseUrl, vinculo.lancamentoBancoId, auto.id);
      console.log(`  OK AUTO-FAT ${novoFat.toFixed(2)} = banco ${banco.toFixed(2)} (id cartão ${auto.id})`);
      ok += 1;
    } catch (e) {
      console.log(`  ERRO: ${e.message}`);
      erros += 1;
    }
  }

  console.log(`\n→ ${ok} alinhado(s), ${erros} erro(s)`);
  if (erros > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
