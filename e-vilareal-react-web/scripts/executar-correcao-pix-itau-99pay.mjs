#!/usr/bin/env node
/**
 * Executa correção PIX Itaú ↔ 99 Pay (plano aprovado).
 * Uso: node scripts/executar-correcao-pix-itau-99pay.mjs
 */

import './lib/load-vilareal-import-env.mjs';

const base = (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
const senha = process.env.VILAREAL_IMPORT_SENHA || '123456';
const CONTA_E_ID = 6;

/** @type {{ label: string, grupo?: string, itau: number, pay99: number, dev?: number, skipDelete?: boolean }[]} */
const FLUXOS = [
  { label: '#1 jan', grupo: '13197', itau: 23554, pay99: 68664, dev: 23547 },
  { label: '#2 mar', grupo: '13634', itau: 24088, pay99: 68701, dev: 24109 },
  { label: '#3 mar', grupo: '13752', itau: 24175, pay99: 68706, dev: 24197 },
  { label: '#4 mar', grupo: '13751', itau: 24231, pay99: 68709, dev: 24287 },
  { label: '#5 mar', grupo: '13724', itau: 24333, pay99: 68711, dev: 24373 },
  { label: '#6 mar', grupo: '13723', itau: 24409, pay99: 68721, dev: 24419 },
  { label: '#8 abr', grupo: '13626', itau: 24667, pay99: 68741, dev: 24678 },
  { label: '#9 abr', grupo: '13625', itau: 24699, pay99: 68740, dev: 24710 },
  { label: '#10 abr', grupo: '13624', itau: 24718, pay99: 68746, dev: 24725 },
  { label: '#11-13 out 68768', grupo: '15701', itau: 27044, pay99: 68768, dev: 27045 },
  { label: '#11-13 out 68768 b', grupo: '15291', itau: 27044, pay99: 68768, dev: 27049, skipParear: true },
  { label: '#14 out', grupo: '15175', itau: 27141, pay99: 68771 },
  { label: '#15 out', grupo: '15171', itau: 27157, pay99: 68778 },
  { label: '#16 out', grupo: '15039', itau: 27195, pay99: 68783 },
  { label: '#17 out', grupo: '15040', itau: 27190, pay99: 68785 },
  { label: '#18 out', grupo: '15170', itau: 27207, pay99: 68789 },
  { label: '#19 out', grupo: '15169', itau: 27223, pay99: 68798 },
];

const stats = {
  gruposDesfeitos: 0,
  novosPares: 0,
  orfaosTratados: 0,
  erros: [],
  detalhes: [],
};

async function login() {
  const r = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'itamar', senha }),
  });
  if (!r.ok) throw new Error(`Login falhou: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.accessToken;
}

async function api(token, method, path, body) {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: r.ok, status: r.status, json };
}

async function getLanc(token, id) {
  const { ok, status, json } = await api(token, 'GET', `/api/financeiro/lancamentos/${id}`);
  if (!ok) throw new Error(`GET lanc ${id}: ${status} ${JSON.stringify(json)}`);
  return json;
}

async function putOrfaoE(token, id) {
  const l = await getLanc(token, id);
  const body = {
    contaContabilId: CONTA_E_ID,
    clienteId: l.clienteId ?? null,
    processoId: l.processoId ?? null,
    bancoNome: l.bancoNome,
    numeroBanco: l.numeroBanco,
    numeroLancamento: l.numeroLancamento,
    dataLancamento: l.dataLancamento,
    dataCompetencia: l.dataCompetencia ?? null,
    descricao: l.descricao,
    descricaoDetalhada: l.descricaoDetalhada ?? null,
    valor: l.valor,
    natureza: l.natureza,
    refTipo: l.refTipo ?? 'N',
    origem: l.origem ?? null,
    status: l.status ?? null,
    etapa: l.etapa ?? null,
    grupoCompensacao: null,
  };
  const { ok, status, json } = await api(token, 'PUT', `/api/financeiro/lancamentos/${id}`, body);
  if (!ok) throw new Error(`PUT orfão ${id}: ${status} ${JSON.stringify(json)}`);
  return json;
}

async function confirmarPar(token, itau, pay99) {
  const [a, b] = await Promise.all([getLanc(token, itau), getLanc(token, pay99)]);
  const gA = a.grupoCompensacao;
  const gB = b.grupoCompensacao;
  const ok =
    gA &&
    gB &&
    gA === gB &&
    a.contaContabilId === CONTA_E_ID &&
    b.contaContabilId === CONTA_E_ID;
  return { ok, grupo: gA, a, b };
}

async function main() {
  const token = await login();
  const gruposDeletados = new Set();
  const paresCriados = new Set();

  for (const f of FLUXOS) {
    const linha = { label: f.label, grupo: f.grupo, itau: f.itau, pay99: f.pay99 };
    try {
      if (f.grupo && !gruposDeletados.has(f.grupo)) {
        const del = await api(token, 'DELETE', `/api/financeiro/lancamentos/parear/${encodeURIComponent(f.grupo)}`);
        if (!del.ok) {
          throw new Error(`DELETE ${f.grupo}: ${del.status} ${JSON.stringify(del.json)}`);
        }
        gruposDeletados.add(f.grupo);
        stats.gruposDesfeitos += 1;
        linha.delete = del.json;
      }

      const parKey = `${f.itau}-${f.pay99}`;
      if (!f.skipParear && !paresCriados.has(parKey)) {
        const post = await api(token, 'POST', '/api/financeiro/lancamentos/parear', {
          pares: [{ lancamentoIdA: f.itau, lancamentoIdB: f.pay99 }],
        });
        if (!post.ok) {
          throw new Error(`POST parear: ${post.status} ${JSON.stringify(post.json)}`);
        }
        if (post.json?.erros?.length) {
          throw new Error(`POST parear erros: ${JSON.stringify(post.json.erros)}`);
        }
        paresCriados.add(parKey);
        stats.novosPares += post.json?.pareados ?? 1;
        linha.parear = post.json;
      }

      const conf = await confirmarPar(token, f.itau, f.pay99);
      linha.confirmado = conf.ok;
      linha.novoGrupo = conf.grupo;

      if (f.dev) {
        const put = await putOrfaoE(token, f.dev);
        stats.orfaosTratados += 1;
        linha.orfao = { id: f.dev, conta: put.contaContabilId, grupo: put.grupoCompensacao };
      }

      console.log(`OK ${f.label} grupo=${f.grupo ?? '—'} novoGrupo=${linha.novoGrupo} orfao=${f.dev ?? '—'}`);
      stats.detalhes.push(linha);
    } catch (e) {
      const msg = `${f.label}: ${e.message}`;
      stats.erros.push(msg);
      console.error(`ERRO ${msg}`);
      stats.detalhes.push({ ...linha, erro: e.message });
    }
  }

  const inc = await api(
    token,
    'GET',
    '/api/financeiro/lancamentos/grupos-compensacao/inconsistentes?page=0&size=100'
  );

  console.log('\n=== RESUMO ===');
  console.log(`Grupos desfeitos: ${stats.gruposDesfeitos}`);
  console.log(`Novos pares cross-banco criados: ${stats.novosPares}`);
  console.log(`Lançamentos órfãos tratados: ${stats.orfaosTratados}`);
  console.log(`Erros: ${stats.erros.length}`);
  if (stats.erros.length) console.log(stats.erros.join('\n'));

  console.log('\n=== GRUPOS INCONSISTENTES ===');
  if (!inc.ok) {
    console.log(`Falha GET inconsistentes: ${inc.status}`, inc.json);
  } else {
    console.log(`Total: ${inc.json?.total ?? 0}`);
    for (const g of inc.json?.grupos ?? []) {
      console.log(
        `  ${g.grupoCompensacao} soma=${g.soma} n=${g.lancamentos?.length} sugestao=${g.sugestao}`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
