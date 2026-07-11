/**
 * Carga da CONTA ZERO (conta 19) — acerto do cliente SE77E TELECOM (código 00000728, cliente 729).
 *
 * Etapas (plano acerto_financeiro_se77e):
 *   abertura      — apura resíduo do último acerto (conta 18 pós 10/01/2024); cria abertura só se ≠ 0
 *   mensalidades  — CREDITO R$ 2.500/mês de 02/2024 até o mês atual (proc 0, "Sette Mensal - MM/AAAA")
 *   parcelas50k   — espelhos CREDITO dos 2 pagamentos de R$ 50.000 (ids 175718 e 269273, 06/01/2025)
 *   orfaos        — vincula cliente 729 nos lançamentos que citam SE77E sem cliente_id
 *   recebimentos  — p/ cada crédito real ≥ 11/01/2024 (por proc): DEBITO espelho (repasse devido,
 *                   valor cheio) + CREDITO honorários 20% na conta 19
 *   devolucao     — espelho invertido da DEV PIX R$ 155 (id 266025): CREDITO 155 + DEBITO 31 (estorno 20%)
 *   mensalista    — cadastra SE77E como mensalista (R$ 2.500, dia 10, início 08/2026)
 *   resumo        — GET /conta-acerto/resumo e conferência de sanidade
 *
 * Idempotente: numeroLancamento determinístico ("CZ-...") + pré-carga dos existentes na conta 19.
 * Leitura da base local (MySQL 3307) só para montar manifests; TODA escrita via API (validações do backend).
 *
 * Uso (na pasta e-vilareal-react-web):
 *   node scripts/carga-conta-zero-se77e.mjs                       # dry-run, todas as etapas
 *   node scripts/carga-conta-zero-se77e.mjs --executar
 *   node scripts/carga-conta-zero-se77e.mjs --executar --etapas=mensalidades,resumo
 *   node scripts/carga-conta-zero-se77e.mjs --base-url=http://localhost:8080
 *
 * Envs: VILAREAL_IMPORT_LOGIN / VILAREAL_IMPORT_SENHA (carregados de .env.import.local).
 * ATENÇÃO: o alvo é SEMPRE localhost:8080, salvo --base-url= explícito (ignora VILAREAL_API_BASE
 * para não gravar em produção por engano).
 */

import './lib/load-vilareal-import-env.mjs';
import mysql from 'mysql2/promise';

const CLIENTE_ID = 729;
const COD_CLIENTE = '00000728';
const TAG = '[CC_CLI:728]';
const NUMERO_BANCO_CZ = 19;
const BANCO_NOME_CZ = 'CONTA ZERO';
const MENSALIDADE = 2500.0;
const PCT_HONORARIOS = 0.2;
const IDS_50K = [175718, 269273];
const ID_DEVOLUCAO = 266025;
const ORIGEM = 'CARGA-CZ-SE77E';
const CORTE = '2024-01-11';
const MENS_INICIO = { ano: 2024, mes: 2 };
const CONTAS_MANUAIS_LEGADAS = [9, 17, 18];

function parseArgs(argv) {
  const out = {
    executar: false,
    baseUrl: 'http://localhost:8080',
    etapas: null,
    concurrency: 8,
  };
  for (const a of argv.slice(2)) {
    if (a === '--executar') out.executar = true;
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--etapas=')) out.etapas = a.slice(9).split(',').map((s) => s.trim());
    else if (a.startsWith('--concurrency=')) out.concurrency = Math.max(1, Number(a.slice(14)) || 8);
    else {
      console.error(`Argumento desconhecido: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

function brl(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function login(baseUrl) {
  const loginUser = (process.env.VILAREAL_IMPORT_LOGIN || 'itamar').trim().toLowerCase();
  const senha = process.env.VILAREAL_IMPORT_SENHA || '';
  if (!senha) throw new Error('Defina VILAREAL_IMPORT_SENHA (ou .env.import.local).');
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginUser, senha }),
  });
  if (!res.ok) throw new Error(`Login falhou ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  if (!j.accessToken) throw new Error('Login sem accessToken');
  return j.accessToken;
}

async function apiGet(ctx, path) {
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${ctx.token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function apiSend(ctx, method, path, body) {
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${method} ${path}: ${res.status} ${(await res.text()).slice(0, 400)}`);
  }
  return res.json();
}

/** Cria lançamento na conta 19 (pula se numeroLancamento já existe). */
async function criarLancamentoCz(ctx, l) {
  if (ctx.existentesCz.has(l.numeroLancamento)) {
    ctx.stats.pulados += 1;
    return null;
  }
  if (!ctx.executar) {
    ctx.stats.criariam += 1;
    return null;
  }
  const body = {
    contaContabilId: ctx.contaContabilAId,
    clienteId: CLIENTE_ID,
    processoId: l.processoId ?? null,
    bancoNome: BANCO_NOME_CZ,
    numeroBanco: NUMERO_BANCO_CZ,
    numeroLancamento: l.numeroLancamento,
    dataLancamento: l.data,
    dataCompetencia: l.dataCompetencia ?? l.data,
    descricao: l.descricao,
    descricaoDetalhada: l.descricaoDetalhada ?? '',
    valor: round2(Math.abs(l.valor)),
    natureza: l.natureza,
    refTipo: 'N',
    origem: ORIGEM,
    status: 'ATIVO',
    ...(l.visivelCliente === false ? { visivelCliente: false } : {}),
    ...(l.valorCliente != null ? { valorCliente: round2(l.valorCliente) } : {}),
  };
  const saved = await apiSend(ctx, 'POST', '/api/financeiro/lancamentos', body);
  ctx.existentesCz.add(l.numeroLancamento);
  ctx.stats.criados += 1;
  return saved;
}

async function criarEmLote(ctx, itens, rotulo) {
  let indice = 0;
  const erros = [];
  async function worker() {
    while (indice < itens.length) {
      const i = indice;
      indice += 1;
      try {
        await criarLancamentoCz(ctx, itens[i]);
      } catch (e) {
        erros.push(`${itens[i].numeroLancamento}: ${e.message}`);
      }
      if ((i + 1) % 500 === 0) console.log(`  ${rotulo}: ${i + 1}/${itens.length}…`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(ctx.concurrency, itens.length || 1) }, worker));
  if (erros.length) {
    console.error(`  ${rotulo}: ${erros.length} erro(s):`);
    for (const e of erros.slice(0, 10)) console.error(`    ${e}`);
    if (erros.length > 10) console.error(`    … +${erros.length - 10}`);
  }
  return erros;
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

async function etapaAbertura(ctx) {
  console.log('\n== abertura — resíduo do último acerto (10/01/2024) ==');
  const [rows] = await ctx.db.query(
    `SELECT COUNT(*) c, COALESCE(SUM(CASE WHEN natureza='CREDITO' THEN valor ELSE -valor END),0) s
     FROM financeiro_lancamento
     WHERE cliente_id=? AND numero_banco=18 AND status='ATIVO' AND data_lancamento > '2024-01-10'`,
    [CLIENTE_ID],
  );
  const { c, s } = rows[0];
  console.log(`  Conta 18 (recorte 729) após o acerto: ${c} lançamento(s), soma ${brl(s)}.`);
  const residuo = round2(Number(s));
  if (Math.abs(residuo) < 0.005) {
    console.log('  PDF de dez/2023 fecha em 0,00 e não há movimento posterior → SEM lançamento de abertura.');
    return;
  }
  await criarLancamentoCz(ctx, {
    numeroLancamento: 'CZ-ABERTURA-2024',
    data: '2024-01-11',
    natureza: residuo >= 0 ? 'CREDITO' : 'DEBITO',
    valor: Math.abs(residuo),
    descricao: 'Saldo de abertura — transporte do último acerto (10/01/2024)',
    descricaoDetalhada: `Resíduo apurado da conta 18 após o acerto de dez/2023 ${TAG}`,
  });
  console.log(`  Lançamento de abertura ${residuo >= 0 ? 'CREDITO' : 'DEBITO'} ${brl(Math.abs(residuo))}.`);
}

async function etapaMensalidades(ctx) {
  console.log('\n== mensalidades — R$ 2.500 de 02/2024 até o mês atual (dia 10, proc 0) ==');
  const hoje = new Date();
  const fim = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const itens = [];
  let { ano, mes } = MENS_INICIO;
  while (ano < fim.ano || (ano === fim.ano && mes <= fim.mes)) {
    const mm = String(mes).padStart(2, '0');
    itens.push({
      numeroLancamento: `CZ-MENS-${ano}-${mm}`,
      data: `${ano}-${mm}-10`,
      natureza: 'CREDITO',
      valor: MENSALIDADE,
      descricao: `Sette Mensal - ${mm}/${ano}`,
      descricaoDetalhada: `Contrato Sette - ${mm}/${ano} ${TAG}`,
    });
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  console.log(`  ${itens.length} mensalidades (${brl(itens.length * MENSALIDADE)}).`);
  await criarEmLote(ctx, itens, 'mensalidades');
}

async function etapaParcelas50k(ctx) {
  console.log('\n== parcelas50k — espelhos dos 2 pagamentos de R$ 50.000 (06/01/2025) ==');
  const [rows] = await ctx.db.query(
    `SELECT id, data_lancamento, valor, numero_banco, banco_nome, descricao
     FROM financeiro_lancamento WHERE id IN (?) AND status='ATIVO'`,
    [IDS_50K],
  );
  if (rows.length !== IDS_50K.length) {
    throw new Error(`Esperava ${IDS_50K.length} lançamentos de 50 mil; achou ${rows.length}.`);
  }
  const itens = rows.map((r) => ({
    numeroLancamento: `CZ-PGTO-${r.id}`,
    data: String(r.data_lancamento).slice(0, 10),
    natureza: 'CREDITO',
    valor: Number(r.valor),
    descricao: `Pagamento à SE77E — parcela R$ 50 mil (${r.banco_nome ?? `banco ${r.numero_banco}`})`,
    descricaoDetalhada: `Espelho do lançamento ${r.id} (${r.descricao}) ${TAG}`,
  }));
  await criarEmLote(ctx, itens, 'parcelas50k');
  console.log(`  ${itens.length} espelhos CREDITO de ${brl(50000)}.`);
  console.log('  NOTA: individualização por proc do que os 100 mil cobriram fica a critério do acerto (sem fonte).');
}

async function etapaOrfaos(ctx) {
  console.log('\n== orfaos — vincular cliente 729 nos lançamentos que citam SE77E sem cliente_id ==');
  const [rows] = await ctx.db.query(
    `SELECT id FROM financeiro_lancamento
     WHERE cliente_id IS NULL AND status='ATIVO' AND descricao_detalhada LIKE '%SE77E%'
     ORDER BY data_lancamento`,
  );
  console.log(`  ${rows.length} órfão(s) encontrados.`);
  for (const { id } of rows) {
    const atual = await apiGet(ctx, `/api/financeiro/lancamentos/${id}`);
    if (Number(atual.clienteId) === CLIENTE_ID) {
      ctx.stats.pulados += 1;
      continue;
    }
    if (!ctx.executar) {
      console.log(`  [dry-run] vincularia ${id} (${atual.dataLancamento} ${atual.natureza} ${brl(atual.valor)})`);
      ctx.stats.criariam += 1;
      continue;
    }
    await apiSend(ctx, 'PUT', `/api/financeiro/lancamentos/${id}`, {
      contaContabilId: atual.contaContabilId,
      clienteId: CLIENTE_ID,
      processoId: atual.processoId ?? null,
      pessoaRefId: atual.pessoaRefId ?? null,
      bancoNome: atual.bancoNome ?? null,
      numeroBanco: atual.numeroBanco ?? null,
      numeroLancamento: atual.numeroLancamento,
      dataLancamento: atual.dataLancamento,
      dataCompetencia: atual.dataCompetencia ?? atual.dataLancamento,
      descricao: atual.descricao,
      descricaoDetalhada: atual.descricaoDetalhada ?? '',
      valor: atual.valor,
      natureza: atual.natureza,
      refTipo: atual.refTipo ?? 'N',
      origem: atual.origem ?? 'MANUAL',
      status: atual.status ?? 'ATIVO',
      grupoCompensacao: atual.grupoCompensacao ?? null,
    });
    ctx.stats.criados += 1;
    console.log(`  vinculado ${id} → cliente ${CLIENTE_ID}`);
  }
}

async function etapaRecebimentos(ctx) {
  console.log('\n== recebimentos — contrapartidas dos créditos reais ≥ 11/01/2024 (repasse cheio + honorários 20%) ==');
  const [rows] = await ctx.db.query(
    `SELECT id, data_lancamento, valor, processo_id, descricao, descricao_detalhada
     FROM financeiro_lancamento
     WHERE cliente_id=? AND natureza='CREDITO' AND status='ATIVO'
       AND data_lancamento >= ? AND processo_id IS NOT NULL
       AND numero_banco IS NOT NULL AND numero_banco NOT IN (?)
     ORDER BY data_lancamento, id`,
    [CLIENTE_ID, CORTE, [...CONTAS_MANUAIS_LEGADAS, NUMERO_BANCO_CZ]],
  );
  const total = rows.reduce((a, r) => a + Number(r.valor), 0);
  console.log(`  ${rows.length} créditos originais somando ${brl(total)}.`);
  const itens = [];
  for (const r of rows) {
    const data = String(r.data_lancamento).slice(0, 10);
    const valor = Number(r.valor);
    const hon = round2(valor * PCT_HONORARIOS);
    const detalhe = String(r.descricao_detalhada ?? '').trim() || `${r.descricao} ${TAG}`;
    itens.push({
      numeroLancamento: `CZ-REP-${r.id}`,
      data,
      natureza: 'DEBITO',
      valor,
      processoId: r.processo_id,
      descricao: `Repasse devido — ${String(r.descricao ?? '').slice(0, 460)}`,
      descricaoDetalhada: detalhe,
    });
    itens.push({
      numeroLancamento: `CZ-HON-${r.id}`,
      data,
      natureza: 'CREDITO',
      valor: hon,
      processoId: r.processo_id,
      descricao: `Honorários 20% — ${String(r.descricao ?? '').slice(0, 460)}`,
      descricaoDetalhada: detalhe,
    });
  }
  const somaDeb = itens.filter((i) => i.natureza === 'DEBITO').reduce((a, i) => a + i.valor, 0);
  const somaHon = itens.filter((i) => i.natureza === 'CREDITO').reduce((a, i) => a + i.valor, 0);
  console.log(
    `  A criar: ${itens.length} lançamentos (repasses −${brl(somaDeb)} + honorários +${brl(somaHon)} → líquido ${brl(somaHon - somaDeb)}).`,
  );
  await criarEmLote(ctx, itens, 'recebimentos');
}

async function etapaDevolucao(ctx) {
  console.log('\n== devolucao — espelho invertido da DEV PIX R$ 155 (id 266025, proc 10702) ==');
  const [rows] = await ctx.db.query(
    `SELECT id, data_lancamento, valor, processo_id, descricao FROM financeiro_lancamento WHERE id=? AND status='ATIVO'`,
    [ID_DEVOLUCAO],
  );
  if (!rows.length) throw new Error(`Devolução ${ID_DEVOLUCAO} não encontrada.`);
  const r = rows[0];
  const data = String(r.data_lancamento).slice(0, 10);
  const valor = Number(r.valor);
  const hon = round2(valor * PCT_HONORARIOS);
  await criarEmLote(
    ctx,
    [
      {
        numeroLancamento: `CZ-DEV-${r.id}`,
        data,
        natureza: 'CREDITO',
        valor,
        processoId: r.processo_id,
        descricao: `Estorno de repasse — devolução PIX (${r.descricao})`,
        descricaoDetalhada: `Espelho invertido do lançamento ${r.id} ${TAG}`,
      },
      {
        numeroLancamento: `CZ-DEVHON-${r.id}`,
        data,
        natureza: 'DEBITO',
        valor: hon,
        processoId: r.processo_id,
        descricao: `Estorno honorários 20% — devolução PIX (${r.descricao})`,
        descricaoDetalhada: `Espelho invertido do lançamento ${r.id} ${TAG}`,
      },
    ],
    'devolucao',
  );
  console.log(`  Espelho CREDITO ${brl(valor)} + DEBITO ${brl(hon)} (líquido +${brl(valor - hon)}).`);
}

async function etapaMensalista(ctx) {
  console.log('\n== mensalista — SE77E R$ 2.500, dia 10, início 08/2026 ==');
  let atual = null;
  try {
    atual = await apiGet(ctx, `/api/mensalistas/cliente/${CLIENTE_ID}`);
  } catch {
    /* 404 = sem cadastro */
  }
  if (atual?.id && Number(atual.valor) === MENSALIDADE && atual.ativo) {
    console.log('  Já cadastrado com os mesmos parâmetros — nada a fazer.');
    return;
  }
  if (!ctx.executar) {
    console.log('  [dry-run] cadastraria mensalista (PUT /api/mensalistas).');
    return;
  }
  const salvo = await apiSend(ctx, 'PUT', '/api/mensalistas', {
    clienteId: CLIENTE_ID,
    valor: MENSALIDADE,
    diaVencimento: 10,
    dataInicio: '2026-08-01',
    dataFim: null,
    ativo: true,
  });
  console.log(`  Mensalista salvo (id ${salvo.id}). Recebíveis futuros gerados a partir de 08/2026.`);
}

async function etapaResumo(ctx) {
  console.log('\n== resumo — conta-acerto/resumo (conta 19) ==');
  const r = await apiGet(ctx, `/api/financeiro/conta-acerto/resumo?numeroBanco=${NUMERO_BANCO_CZ}`);
  console.log(`  Lançamentos: ${r.totalLancamentos} (pendentes ${r.totalPendentes})`);
  console.log(`  Soma da conta: ${brl(r.somaConta)} · soma pendente: ${brl(r.somaPendente)}`);
  for (const v of r.vinculos ?? []) {
    console.log(
      `    ${v.codigoCliente ?? `pessoa ${v.pessoaRefId}`} ${v.nome ?? ''}: ${v.totalLancamentos} lanç., saldo ${brl(v.saldo)}, pendente ${brl(v.saldoPendente)} (${v.pendentes} lanç.)`,
    );
  }
  const saldo = Number(r.somaPendente ?? 0);
  console.log(
    saldo < 0
      ? `  → Saldo do acerto: ${brl(Math.abs(saldo))} a favor do CLIENTE.`
      : saldo > 0
        ? `  → Saldo do acerto: ${brl(saldo)} a favor do ESCRITÓRIO.`
        : '  → Acerto zerado.',
  );
  console.log('  Sanidade do plano: resíduo esperado na casa de R$ 155 mil a favor do cliente.');
}

// ---------------------------------------------------------------------------

const ETAPAS = {
  abertura: etapaAbertura,
  mensalidades: etapaMensalidades,
  parcelas50k: etapaParcelas50k,
  orfaos: etapaOrfaos,
  recebimentos: etapaRecebimentos,
  devolucao: etapaDevolucao,
  mensalista: etapaMensalista,
  resumo: etapaResumo,
};

async function main() {
  const opts = parseArgs(process.argv);
  const etapas = opts.etapas ?? Object.keys(ETAPAS);
  for (const e of etapas) {
    if (!ETAPAS[e]) {
      console.error(`Etapa desconhecida: ${e}. Válidas: ${Object.keys(ETAPAS).join(', ')}`);
      process.exit(1);
    }
  }

  console.log(`Alvo API: ${opts.baseUrl} — ${opts.executar ? 'EXECUTAR' : 'DRY-RUN'}`);
  console.log(`Etapas: ${etapas.join(', ')}`);

  const db = await mysql.createConnection({
    host: process.env.VILAREAL_MYSQL_HOST || 'localhost',
    port: Number(process.env.VILAREAL_MYSQL_PORT || 3307),
    user: process.env.VILAREAL_MYSQL_USER || 'root',
    password: process.env.VILAREAL_MYSQL_PASSWORD || 'root',
    database: process.env.VILAREAL_MYSQL_DATABASE || 'vilareal',
    timezone: 'Z',
    dateStrings: true,
  });

  const token = await login(opts.baseUrl);

  const contas = await (async () => {
    const res = await fetch(`${opts.baseUrl}/api/financeiro/contas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  })();
  const contaA = (contas ?? []).find((c) => String(c.codigo ?? '').toUpperCase() === 'A');
  if (!contaA?.id) throw new Error('Conta contábil A (Escritório) não encontrada.');

  const [existRows] = await db.query(
    `SELECT numero_lancamento FROM financeiro_lancamento WHERE numero_banco=? AND status='ATIVO'`,
    [NUMERO_BANCO_CZ],
  );
  const existentesCz = new Set(existRows.map((r) => String(r.numero_lancamento)));
  console.log(`Conta 19 tem ${existentesCz.size} lançamento(s) ativos (idempotência por numeroLancamento).`);

  const ctx = {
    baseUrl: opts.baseUrl,
    token,
    db,
    executar: opts.executar,
    concurrency: opts.concurrency,
    contaContabilAId: Number(contaA.id),
    existentesCz,
    stats: { criados: 0, pulados: 0, criariam: 0 },
  };

  try {
    for (const e of etapas) {
      await ETAPAS[e](ctx);
    }
  } finally {
    await db.end();
  }

  console.log(
    `\nFim. ${opts.executar ? `Criados/atualizados: ${ctx.stats.criados}` : `Criariam: ${ctx.stats.criariam}`} · pulados (já existiam): ${ctx.stats.pulados}`,
  );
}

main().catch((e) => {
  console.error(`ERRO: ${e.message}`);
  process.exit(1);
});
