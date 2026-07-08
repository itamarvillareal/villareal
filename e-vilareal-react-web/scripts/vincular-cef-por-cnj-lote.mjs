#!/usr/bin/env node
/**
 * Vincula lançamentos CEF (numeroBanco 5) à Conta Escritório (A) por CNJ do complemento.
 *
 * Uso (a partir de e-vilareal-react-web/):
 *   node scripts/vincular-cef-por-cnj-lote.mjs --vps --dry-run
 *   node scripts/vincular-cef-por-cnj-lote.mjs --vps --executar
 */
import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';

const VPS_BASE = 'https://portal.villarealadvocacia.adv.br';
const NUMERO_BANCO_CEF = 5;
const CONTA_ESCRITORIO_NOME = 'Conta Escritório';

/** Lançamentos extraídos dos extratos CEF (screenshots jun/jul 2026). */
const LANCAMENTOS_ALVO = [
  { valor: 2500.0, dataIso: '2026-06-12', cnj: '5176468-44.2024.8.09.0006' },
  { valor: 1052.0, dataIso: '2026-06-01', cnj: '0010702-48.2022.5.18.0053' },
  { valor: 38.97, dataIso: '2026-06-16', cnj: '0010702-48.2022.5.18.0053' },
  { valor: 4394.42, dataIso: '2026-06-01', cnj: '0010702-48.2022.5.18.0053' },
  { valor: 334.49, dataIso: '2026-06-26', cnj: '5867087-20.2023.8.09.0001' },
  { valor: 926.27, dataIso: '2026-07-07', cnj: '6030290-72.2025.8.09.0007' },
  { valor: 1307.44, dataIso: '2026-06-29', cnj: '5036693-11.2024.8.09.0007' },
  { valor: 29.26, dataIso: '2026-07-07', cnj: '6030290-72.2025.8.09.0007' },
  { valor: 1.0, dataIso: '2026-07-07', cnj: '6030290-72.2025.8.09.0007' },
  { valor: 0.63, dataIso: '2026-07-07', cnj: '6030290-72.2025.8.09.0007' },
  { valor: 0.05, dataIso: '2026-07-07', cnj: '6030290-72.2025.8.09.0007' },
  { valor: 31.31, dataIso: '2026-07-07', cnj: '6030290-72.2025.8.09.0007' },
  { valor: 108.37, dataIso: '2026-07-07', cnj: '6030290-72.2025.8.09.0007' },
  { valor: 0.56, dataIso: '2026-07-07', cnj: '6030290-72.2025.8.09.0007' },
];

function parseArgs(argv) {
  const out = {
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: true,
    vps: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--executar') out.dryRun = false;
    else if (a === '--vps') {
      out.vps = true;
      out.baseUrl = VPS_BASE;
    } else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
  }
  if (out.vps && !process.argv.some((x) => x.startsWith('--base-url='))) {
    out.baseUrl = VPS_BASE;
  }
  return out;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function login(opts) {
  const res = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: String(opts.login).trim().toLowerCase(),
      senha: opts.senha,
    }),
  });
  if (!res.ok) throw new Error(`Login falhou ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const j = await res.json();
  if (!j.accessToken) throw new Error('Login sem accessToken');
  return j.accessToken;
}

async function listarContas(token, baseUrl) {
  const res = await fetch(`${baseUrl}/api/financeiro/contas`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`GET contas: ${res.status}`);
  return res.json();
}

async function listarLancamentosCef(token, baseUrl) {
  const out = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages) {
    const qs = new URLSearchParams({
      page: String(page),
      size: '200',
      sort: 'dataLancamento,asc',
      numeroBanco: String(NUMERO_BANCO_CEF),
    });
    const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/paginada?${qs}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(`GET lançamentos pág ${page}: ${res.status}`);
    const j = await res.json();
    out.push(...(j?.content ?? []));
    totalPages = Math.max(1, Number(j?.totalPages ?? 1));
    page += 1;
  }
  return out;
}

async function buscarDiagnosticoCnj(token, baseUrl, cnj) {
  const qs = new URLSearchParams({ numero: cnj });
  const res = await fetch(`${baseUrl}/api/processos/diagnostico/busca-numero?${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Diagnóstico CNJ ${cnj}: ${res.status}`);
  const hits = await res.json();
  return Array.isArray(hits) ? hits : [];
}

async function buscarProcessoPorChave(token, baseUrl, codigoCliente, numeroInterno) {
  const qs = new URLSearchParams({
    codigoCliente: String(codigoCliente).padStart(8, '0'),
    numeroInterno: String(numeroInterno),
  });
  const res = await fetch(`${baseUrl}/api/processos?${qs}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`GET processo ${codigoCliente}/${numeroInterno}: ${res.status}`);
  const body = await res.json();
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    if (body.id != null) return body;
    if (Array.isArray(body.content)) {
      return body.content.find((p) => Number(p?.numeroInterno) === Number(numeroInterno)) ?? null;
    }
  }
  return null;
}

function valorIgual(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.005;
}

function cnjDigits(cnj) {
  return String(cnj ?? '').replace(/\D/g, '');
}

function lancamentoJaVinculado(l, procCache) {
  if (l.processoId && l.codigoCliente && l.numeroInternoProcesso != null) return true;
  const det = String(l.descricaoDetalhada ?? '').toUpperCase();
  for (const cnj of procCache.keys()) {
    const dig = cnjDigits(cnj);
    if (dig && det.includes(dig)) return true;
  }
  return false;
}

function encontrarLancamento(lancamentos, alvo, usados) {
  const candidatos = lancamentos.filter((l) => {
    if (usados.has(l.id)) return false;
    if (String(l.dataLancamento ?? '').slice(0, 10) !== alvo.dataIso) return false;
    if (!valorIgual(l.valor, alvo.valor)) return false;
    if (String(l.natureza ?? '').toUpperCase() !== 'CREDITO') return false;
    return true;
  });
  if (candidatos.length === 1) return candidatos[0];
  if (candidatos.length > 1) {
    const dig = cnjDigits(alvo.cnj);
    const comCnj = candidatos.filter((l) => cnjDigits(l.descricaoDetalhada).includes(dig));
    if (comCnj.length === 1) return comCnj[0];
    const comDesc = candidatos.filter((l) =>
      /CR\s*LV|LEVANT|ORDEM|ELETRON|PROC\s*JUD|CRED/i.test(
        `${l.descricao ?? ''} ${l.descricaoDetalhada ?? ''}`,
      ),
    );
    if (comDesc.length === 1) return comDesc[0];
  }
  return candidatos[0] ?? null;
}

async function resolverProcesso(token, baseUrl, cnj, cache) {
  if (cache.has(cnj)) return cache.get(cnj);
  const hits = await buscarDiagnosticoCnj(token, baseUrl, cnj);
  if (hits.length === 0) {
    cache.set(cnj, null);
    return null;
  }
  const h = hits[0];
  const cod = String(h.codigoCliente ?? '').padStart(8, '0');
  const proc = Number(h.numeroInterno);
  const processoId = Number(h.processoId);
  let clienteId = null;
  const procFull = await buscarProcessoPorChave(token, baseUrl, cod, proc);
  if (procFull?.clienteId != null) clienteId = Number(procFull.clienteId);
  const info = {
    cnj,
    codigoCliente: cod,
    numeroInterno: proc,
    processoId,
    clienteId,
    cliente: String(h.cliente ?? h.parteCliente ?? '').trim(),
    ambiguo: hits.length > 1,
  };
  cache.set(cnj, info);
  return info;
}

async function atualizarLancamento(token, baseUrl, l, contaEscritorioId, procInfo) {
  const body = {
    contaContabilId: contaEscritorioId,
    clienteId: procInfo.clienteId,
    processoId: procInfo.processoId,
    bancoNome: l.bancoNome ?? 'CEF',
    numeroBanco: l.numeroBanco ?? NUMERO_BANCO_CEF,
    numeroLancamento: l.numeroLancamento,
    dataLancamento: l.dataLancamento,
    dataCompetencia: l.dataCompetencia ?? l.dataLancamento,
    descricao: l.descricao,
    descricaoDetalhada: l.descricaoDetalhada,
    valor: l.valor,
    natureza: l.natureza,
    refTipo: l.refTipo ?? 'N',
    origem: l.origem ?? 'OFX',
    status: l.status ?? 'ATIVO',
    grupoCompensacao: l.grupoCompensacao,
  };
  const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/${l.id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, erro: `${res.status}: ${(await res.text()).slice(0, 300)}` };
  }
  const saved = await res.json();
  return { ok: true, saved };
}

function formatMoeda(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA');
    process.exit(1);
  }

  console.log(`API: ${opts.baseUrl}`);
  console.log(`Modo: ${opts.dryRun ? 'dry-run' : 'executar'}`);
  console.log(`Alvos: ${LANCAMENTOS_ALVO.length} lançamentos\n`);

  const token = await login(opts);
  const contas = await listarContas(token, opts.baseUrl);
  const contaA = (contas || []).find(
    (c) =>
      String(c.codigo ?? '').toUpperCase() === 'A' ||
      String(c.nome ?? '').trim() === CONTA_ESCRITORIO_NOME,
  );
  if (!contaA?.id) throw new Error('Conta Escritório (A) não encontrada');
  console.log(`Conta Escritório id=${contaA.id}\n`);

  const lancamentos = await listarLancamentosCef(token, opts.baseUrl);
  console.log(`Lançamentos CEF no sistema: ${lancamentos.length}\n`);

  const procCache = new Map();
  const usados = new Set();
  const resultados = [];

  for (const alvo of LANCAMENTOS_ALVO) {
    const procInfo = await resolverProcesso(token, opts.baseUrl, alvo.cnj, procCache);
    const l = encontrarLancamento(lancamentos, alvo, usados);

    const linha = {
      data: alvo.dataIso,
      valor: alvo.valor,
      cnj: alvo.cnj,
      cod: procInfo?.codigoCliente ?? '—',
      proc: procInfo?.numeroInterno ?? '—',
      cliente: procInfo?.cliente ?? '—',
      lancamentoId: l?.id ?? null,
      status: 'pendente',
      detalhe: '',
    };

    if (!procInfo) {
      linha.status = 'erro';
      linha.detalhe = 'CNJ não encontrado no cadastro';
    } else if (!l) {
      linha.status = 'erro';
      linha.detalhe = 'Lançamento CEF não encontrado (data+valor)';
    } else {
      usados.add(l.id);
      const ja =
        l.processoId &&
        Number(l.processoId) === procInfo.processoId &&
        (l.codigoCliente == null ||
          String(l.codigoCliente ?? '').padStart(8, '0') === procInfo.codigoCliente);
      if (ja) {
        linha.status = 'ok';
        linha.detalhe = 'já vinculado';
      } else if (opts.dryRun) {
        linha.status = 'simular';
        linha.detalhe = `id=${l.id} letra atual=${l.contaContabilNome ?? '?'}`;
      } else {
        const r = await atualizarLancamento(token, opts.baseUrl, l, contaA.id, procInfo);
        if (r.ok) {
          linha.status = 'ok';
          linha.detalhe = `vinculado id=${l.id}`;
        } else {
          linha.status = 'erro';
          linha.detalhe = r.erro;
        }
      }
    }

    resultados.push(linha);
    console.log(
      `${linha.status.padEnd(7)} ${linha.data} ${formatMoeda(linha.valor).padStart(12)} | cod ${linha.cod} proc ${linha.proc} | ${linha.cnj}${linha.lancamentoId ? ` | #${linha.lancamentoId}` : ''}${linha.detalhe ? ` — ${linha.detalhe}` : ''}`,
    );
  }

  console.log('\n=== Resumo por processo ===');
  for (const [, info] of procCache) {
    if (!info) continue;
    const qtd = resultados.filter((r) => r.cnj === info.cnj).length;
    console.log(
      `${info.codigoCliente} / proc ${info.numeroInterno} — ${info.cliente} — CNJ ${info.cnj} (${qtd} lanç.)${info.ambiguo ? ' [ambiguo]' : ''}`,
    );
  }

  const erros = resultados.filter((r) => r.status === 'erro').length;
  const ok = resultados.filter((r) => r.status === 'ok' || r.status === 'simular').length;
  console.log(`\nTotal: ${ok} ok/simular, ${erros} erro(s)`);
  if (opts.dryRun && erros === 0) {
    console.log('\nDry-run concluído. Use --executar para aplicar os vínculos.');
  }
  process.exit(erros > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
