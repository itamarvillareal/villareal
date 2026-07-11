/**
 * FASE 2 do plano acerto_financeiro_se77e — migração da conta 18 para a CONTA ZERO (conta 19)
 * e espelhos do caso Veredas/Karla (cliente 493). Itens 1, 3 e 4 da FASE 2.
 *
 * Etapas:
 *   veredas-migracao — move os 516 créditos do cliente 493 da conta 18 para a conta 19,
 *                      trocando a conta contábil para D (Conta Veredas)
 *   veredas-espelhos — cria espelhos na conta 19 (vínculo 493, letra D) dos 43 débitos Karla
 *                      (R$ 131.908,80) e das 4 devoluções (R$ 38.339,21) desde o corte 07/11/2023
 *   se77e-conta18    — move o recorte SE77E da conta 18 (777 lanç., letra A, sem grupo) para a
 *                      conta 19 (letra A preservada); confere soma migrada = −52.310,39
 *   resto-conta18    — move os demais lançamentos da conta 18 COM cliente_id e SEM grupo de
 *                      compensação, em lotes por cliente (conta contábil preservada);
 *                      os sem vínculo ficam na 18 e são reportados
 *   grupos-zerados   — ESPELHO COMPLETO dos grupos legados que somam zero envolvendo a conta 18
 *                      e sem cliente (625 grupos): espelha o lado banco-real na conta 19
 *                      (CZ-M18-{id}), migra o lado conta 18, limpa o grupo legado com anotação
 *                      e reagrupa tudo em CZ18-{grupo} DENTRO da conta 19 (soma zero).
 *                      Vínculo: pessoa "ESCRITORIO - CONCILIACOES INTERNAS (CONTA ZERO)".
 *                      Os 4 grupos zerados que envolvem a SE77E (729) NÃO são tocados.
 *   clientes-zerados — parear-grupo do recorte inteiro dos clientes zerados 317/642/882
 *                      (13 lançamentos já migrados na etapa resto-conta18)
 *   pares-estritos   — parear-grupo dos pares 1 crédito × 1 débito (mesmo cliente, mesmo valor)
 *                      remanescentes na conta 19 sem grupo
 *   resumo           — GET /conta-acerto/resumo (saldos por vínculo na conta 19)
 *
 * Migrar = PUT no lançamento trocando numeroBanco para 19 (id, número, datas, vínculos e valor
 * preservados) + marcador "migrado da conta 18" na descrição detalhada. Espelho = POST novo
 * lançamento CZ-VK-{id} (idempotente). NÃO compensa nenhum grupo. Alvo SEMPRE localhost salvo
 * --base-url explícito.
 *
 * Uso (na pasta e-vilareal-react-web):
 *   node scripts/migracao-conta-18-cz.mjs                      # dry-run
 *   node scripts/migracao-conta-18-cz.mjs --executar
 *   node scripts/migracao-conta-18-cz.mjs --executar --etapas=veredas-migracao,resumo
 */

import './lib/load-vilareal-import-env.mjs';
import mysql from 'mysql2/promise';

const NUMERO_BANCO_CZ = 19;
const BANCO_NOME_CZ = 'CONTA ZERO';
const CONTA_18 = 18;
const CLIENTE_VEREDAS = 493;
const CLIENTE_SE77E = 729;
const CONTA_CONTABIL_D = 4; // Conta Veredas
const MARCA_MIGRACAO = 'migrado da conta 18';
const ORIGEM_ESPELHO = 'CARGA-CZ-VEREDAS';
const ORIGEM_ESPELHO_M18 = 'MIGRACAO-CZ-18';
const PESSOA_ESCRITORIO_NOME = 'ESCRITORIO - CONCILIACOES INTERNAS (CONTA ZERO)';
const CLIENTES_ZERADOS = [317, 642, 882];
// Corte do caso Veredas: último crédito por proc do 493 na conta 18 (07/11/2023).
const CORTE_KARLA = '2023-11-07';
// Conferências da auditoria do plano (aborta a etapa se divergir).
const AUDIT = {
  veredasQtd: 516,
  veredasSoma: 70000.14,
  karlaDebQtd: 43,
  karlaDebSoma: 131908.8,
  karlaCredQtd: 4,
  karlaCredSoma: 38339.21,
  se77eQtd: 777,
  se77eSaldo: -52310.39,
  // Grupos legados zerados sem cliente (625; os 4 da SE77E ficam de fora)
  gzGrupos: 625,
  gzQtd18: 749,
  gzSoma18: 127576.17,
  gzQtdReal: 881,
  gzSomaReal: -127576.17,
  // Recortes inteiros zerados já migrados (resto-conta18)
  czQtd: 13, // 317: 4, 642: 4, 882: 5
  // Pares estritos remanescentes após clientes-zerados (28 do plano − 2 do 317 − 2 do 642)
  parQtd: 24,
  parSoma: 32295.58,
};

function parseArgs(argv) {
  const out = { executar: false, baseUrl: 'http://localhost:8080', etapas: null, concurrency: 8 };
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

const brl = (n) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round(n * 100) / 100;

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
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${(await res.text()).slice(0, 400)}`);
  return res.json();
}

/**
 * Move um lançamento para a conta 19 preservando tudo; `contaContabilId` opcional troca a letra,
 * `pessoaRefId` opcional define o vínculo, `limparGrupo` remove o grupo de compensação legado.
 */
async function migrarLancamento(
  ctx,
  id,
  { contaContabilId = null, clienteId = null, pessoaRefId = null, limparGrupo = false } = {},
) {
  const atual = await apiGet(ctx, `/api/financeiro/lancamentos/${id}`);
  if (Number(atual.numeroBanco) === NUMERO_BANCO_CZ) {
    ctx.stats.pulados += 1;
    return;
  }
  if (!ctx.executar) {
    ctx.stats.criariam += 1;
    return;
  }
  const detalheBase = atual.descricaoDetalhada ?? '';
  const detalhe = detalheBase.includes(MARCA_MIGRACAO)
    ? detalheBase
    : `${detalheBase}${detalheBase ? ' · ' : ''}${MARCA_MIGRACAO}`.slice(0, 2000);
  await apiSend(ctx, 'PUT', `/api/financeiro/lancamentos/${id}`, {
    contaContabilId: contaContabilId ?? atual.contaContabilId,
    clienteId: clienteId ?? atual.clienteId ?? null,
    processoId: atual.processoId ?? null,
    pessoaRefId: pessoaRefId ?? atual.pessoaRefId ?? null,
    bancoNome: BANCO_NOME_CZ,
    numeroBanco: NUMERO_BANCO_CZ,
    numeroLancamento: atual.numeroLancamento,
    dataLancamento: atual.dataLancamento,
    dataCompetencia: atual.dataCompetencia ?? atual.dataLancamento,
    descricao: atual.descricao,
    descricaoDetalhada: detalhe,
    valor: atual.valor,
    natureza: atual.natureza,
    refTipo: atual.refTipo ?? 'N',
    origem: atual.origem ?? 'MANUAL',
    status: atual.status ?? 'ATIVO',
    visivelCliente: atual.visivelCliente ?? true,
    valorCliente: atual.valorCliente ?? null,
    ...(limparGrupo ? { grupoCompensacao: '' } : {}),
  });
  ctx.stats.criados += 1;
}

/** Limpa o grupo legado de um lançamento de banco real, anotando a conciliação na CONTA ZERO. */
async function limparGrupoLegado(ctx, id, grupoNovo) {
  const atual = await apiGet(ctx, `/api/financeiro/lancamentos/${id}`);
  const anotacao = `conciliado na CONTA ZERO (${grupoNovo})`;
  const jaAnotado = (atual.descricaoDetalhada ?? '').includes(anotacao);
  if (!atual.grupoCompensacao && jaAnotado) {
    ctx.stats.pulados += 1;
    return;
  }
  if (!ctx.executar) {
    ctx.stats.criariam += 1;
    return;
  }
  const detalheBase = atual.descricaoDetalhada ?? '';
  const detalhe = jaAnotado
    ? detalheBase
    : `${detalheBase}${detalheBase ? ' · ' : ''}${anotacao}`.slice(0, 2000);
  await apiSend(ctx, 'PUT', `/api/financeiro/lancamentos/${id}`, {
    contaContabilId: atual.contaContabilId,
    clienteId: atual.clienteId ?? null,
    processoId: atual.processoId ?? null,
    pessoaRefId: atual.pessoaRefId ?? null,
    bancoNome: atual.bancoNome ?? null,
    numeroBanco: atual.numeroBanco,
    numeroLancamento: atual.numeroLancamento,
    dataLancamento: atual.dataLancamento,
    dataCompetencia: atual.dataCompetencia ?? atual.dataLancamento,
    descricao: atual.descricao,
    descricaoDetalhada: detalhe,
    valor: atual.valor,
    natureza: atual.natureza,
    refTipo: atual.refTipo ?? 'N',
    origem: atual.origem ?? 'MANUAL',
    status: atual.status ?? 'ATIVO',
    visivelCliente: atual.visivelCliente ?? true,
    valorCliente: atual.valorCliente ?? null,
    grupoCompensacao: '',
  });
  ctx.stats.criados += 1;
}

/** Garante a pessoa de referência do escritório (vínculo dos grupos internos migrados). */
async function garantirPessoaEscritorio(ctx) {
  const [rows] = await ctx.db.query(`SELECT id FROM pessoa WHERE nome = ? LIMIT 1`, [
    PESSOA_ESCRITORIO_NOME,
  ]);
  if (rows.length) return rows[0].id;
  if (!ctx.executar) {
    console.log(`  [dry-run] criaria a pessoa "${PESSOA_ESCRITORIO_NOME}".`);
    return null;
  }
  const [res] = await ctx.db.query(`INSERT INTO pessoa (nome) VALUES (?)`, [PESSOA_ESCRITORIO_NOME]);
  console.log(`  Pessoa "${PESSOA_ESCRITORIO_NOME}" criada (id ${res.insertId}).`);
  return res.insertId;
}

async function processarEmLote(ctx, itens, rotulo, fn) {
  let indice = 0;
  const erros = [];
  async function worker() {
    while (indice < itens.length) {
      const i = indice;
      indice += 1;
      try {
        await fn(itens[i]);
      } catch (e) {
        erros.push(
          `${itens[i].id ?? itens[i].numeroLancamento ?? itens[i].grupo ?? itens[i].credito?.id}: ${e.message}`,
        );
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

function conferir(rotulo, qtd, qtdEsperada, soma, somaEsperada) {
  const okQtd = qtd === qtdEsperada;
  const okSoma = Math.abs(round2(soma) - somaEsperada) < 0.005;
  console.log(
    `  Conferência ${rotulo}: ${qtd} lanç. (esperado ${qtdEsperada}) · soma ${brl(soma)} (esperado ${brl(somaEsperada)}) ${okQtd && okSoma ? '✓' : '✗ DIVERGE'}`,
  );
  if (!okQtd || !okSoma) {
    throw new Error(`Auditoria de ${rotulo} divergiu do plano — etapa abortada, nada gravado.`);
  }
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

async function etapaVeredasMigracao(ctx) {
  console.log('\n== veredas-migracao — 516 créditos do 493: conta 18 → conta 19, letra D ==');
  const [rows] = await ctx.db.query(
    `SELECT fl.id, fl.natureza, fl.valor, fl.grupo_compensacao
     FROM financeiro_lancamento fl JOIN conta_bancaria cb ON cb.id = fl.conta_bancaria_id
     WHERE cb.numero_banco = ? AND fl.cliente_id = ? AND fl.status = 'ATIVO'
     ORDER BY fl.data_lancamento`,
    [CONTA_18, CLIENTE_VEREDAS],
  );
  const soma = rows.reduce((s, r) => s + (r.natureza === 'CREDITO' ? 1 : -1) * Number(r.valor), 0);
  conferir('Veredas conta 18', rows.length, AUDIT.veredasQtd, soma, AUDIT.veredasSoma);
  const comGrupo = rows.filter((r) => r.grupo_compensacao);
  if (comGrupo.length) console.log(`  ATENÇÃO: ${comGrupo.length} com grupo — serão migrados preservando o grupo.`);
  await processarEmLote(ctx, rows, 'veredas-migracao', (r) =>
    migrarLancamento(ctx, r.id, { contaContabilId: CONTA_CONTABIL_D }),
  );
  console.log(`  ${ctx.executar ? 'Migrados' : '[dry-run] migraria'}: ${rows.length} (soma ${brl(soma)}).`);
}

async function etapaVeredasEspelhos(ctx) {
  console.log('\n== veredas-espelhos — 43 débitos Karla + 4 devoluções → espelhos na conta 19 (493, letra D) ==');
  const [rows] = await ctx.db.query(
    `SELECT fl.id, cb.numero_banco, fl.banco_nome, fl.natureza, fl.valor, fl.data_lancamento,
            fl.descricao, fl.descricao_detalhada
     FROM financeiro_lancamento fl JOIN conta_bancaria cb ON cb.id = fl.conta_bancaria_id
     WHERE (fl.descricao LIKE '%Karla%' OR fl.descricao_detalhada LIKE '%Karla%')
       AND fl.data_lancamento > ? AND fl.status = 'ATIVO' AND cb.numero_banco <> ?
     ORDER BY fl.data_lancamento`,
    [CORTE_KARLA, NUMERO_BANCO_CZ],
  );
  const deb = rows.filter((r) => r.natureza === 'DEBITO');
  const cred = rows.filter((r) => r.natureza === 'CREDITO');
  conferir('débitos Karla', deb.length, AUDIT.karlaDebQtd, deb.reduce((s, r) => s + Number(r.valor), 0), AUDIT.karlaDebSoma);
  conferir('devoluções Karla', cred.length, AUDIT.karlaCredQtd, cred.reduce((s, r) => s + Number(r.valor), 0), AUDIT.karlaCredSoma);
  const itens = rows.map((r) => ({
    id: r.id,
    numeroLancamento: `CZ-VK-${r.id}`,
    body: {
      contaContabilId: CONTA_CONTABIL_D,
      clienteId: CLIENTE_VEREDAS,
      processoId: null,
      bancoNome: BANCO_NOME_CZ,
      numeroBanco: NUMERO_BANCO_CZ,
      numeroLancamento: `CZ-VK-${r.id}`,
      dataLancamento: String(r.data_lancamento).slice(0, 10),
      dataCompetencia: String(r.data_lancamento).slice(0, 10),
      descricao:
        r.natureza === 'DEBITO'
          ? `Salário/transferência Karla — ${r.descricao}`.slice(0, 500)
          : `Devolução Karla — ${r.descricao}`.slice(0, 500),
      descricaoDetalhada: `Espelho do lançamento ${r.id} (banco ${r.numero_banco}) — acerto Veredas/Karla [CC_CLI:491]`,
      valor: round2(Number(r.valor)),
      natureza: r.natureza,
      refTipo: 'N',
      origem: ORIGEM_ESPELHO,
      status: 'ATIVO',
    },
  }));
  await processarEmLote(ctx, itens, 'veredas-espelhos', async (item) => {
    if (ctx.existentesCz.has(item.numeroLancamento)) {
      ctx.stats.pulados += 1;
      return;
    }
    if (!ctx.executar) {
      ctx.stats.criariam += 1;
      return;
    }
    await apiSend(ctx, 'POST', '/api/financeiro/lancamentos', item.body);
    ctx.existentesCz.add(item.numeroLancamento);
    ctx.stats.criados += 1;
  });
  const somaEsp = round2(AUDIT.veredasSoma - AUDIT.karlaDebSoma + AUDIT.karlaCredSoma);
  console.log(`  ${itens.length} espelho(s). Saldo parcial esperado do 493 após a etapa: ${brl(somaEsp)}.`);
}

async function etapaSe77eConta18(ctx) {
  console.log('\n== se77e-conta18 — recorte SE77E da conta 18 (letra A, sem grupo) → conta 19 ==');
  const [rows] = await ctx.db.query(
    `SELECT fl.id, fl.natureza, fl.valor
     FROM financeiro_lancamento fl
     JOIN conta_bancaria cb ON cb.id = fl.conta_bancaria_id
     JOIN financeiro_conta_contabil cc ON cc.id = fl.conta_contabil_id
     WHERE cb.numero_banco = ? AND fl.cliente_id = ? AND fl.status = 'ATIVO'
       AND cc.codigo = 'A' AND fl.grupo_compensacao IS NULL
     ORDER BY fl.data_lancamento`,
    [CONTA_18, CLIENTE_SE77E],
  );
  const saldo = rows.reduce((s, r) => s + (r.natureza === 'CREDITO' ? 1 : -1) * Number(r.valor), 0);
  conferir('SE77E conta 18', rows.length, AUDIT.se77eQtd, saldo, AUDIT.se77eSaldo);
  const [fora] = await ctx.db.query(
    `SELECT fl.id, cc.codigo, fl.grupo_compensacao
     FROM financeiro_lancamento fl
     JOIN conta_bancaria cb ON cb.id = fl.conta_bancaria_id
     LEFT JOIN financeiro_conta_contabil cc ON cc.id = fl.conta_contabil_id
     WHERE cb.numero_banco = ? AND fl.cliente_id = ? AND fl.status = 'ATIVO'
       AND (cc.codigo <> 'A' OR fl.grupo_compensacao IS NOT NULL)`,
    [CONTA_18, CLIENTE_SE77E],
  );
  if (fora.length) {
    console.log(`  Fora da migração (conta E / grupo antigo — ficam na 18): ${fora.map((f) => `${f.id} (${f.codigo}${f.grupo_compensacao ? ` g${f.grupo_compensacao}` : ''})`).join(', ')}`);
  }
  await processarEmLote(ctx, rows, 'se77e-conta18', (r) => migrarLancamento(ctx, r.id));
  console.log(`  ${ctx.executar ? 'Migrados' : '[dry-run] migraria'}: ${rows.length} (saldo ${brl(saldo)} — deve bater com o PDF de dez/2023 via contrapartidas nos bancos).`);
}

async function etapaRestoConta18(ctx) {
  console.log('\n== resto-conta18 — demais lançamentos com cliente_id e sem grupo, em lotes por cliente ==');
  const [rows] = await ctx.db.query(
    `SELECT fl.id, fl.cliente_id, fl.natureza, fl.valor, c.codigo_cliente, p.nome
     FROM financeiro_lancamento fl
     JOIN conta_bancaria cb ON cb.id = fl.conta_bancaria_id
     JOIN cliente c ON c.id = fl.cliente_id
     LEFT JOIN pessoa p ON p.id = c.pessoa_id
     WHERE cb.numero_banco = ? AND fl.status = 'ATIVO'
       AND fl.cliente_id NOT IN (?, ?) AND fl.grupo_compensacao IS NULL
     ORDER BY fl.cliente_id, fl.data_lancamento`,
    [CONTA_18, CLIENTE_VEREDAS, CLIENTE_SE77E],
  );
  const [ficam] = await ctx.db.query(
    `SELECT SUM(fl.cliente_id IS NULL) sem_vinculo, SUM(fl.grupo_compensacao IS NOT NULL) com_grupo
     FROM financeiro_lancamento fl JOIN conta_bancaria cb ON cb.id = fl.conta_bancaria_id
     WHERE cb.numero_banco = ? AND fl.status = 'ATIVO'
       AND (fl.cliente_id IS NULL OR fl.grupo_compensacao IS NOT NULL)`,
    [CONTA_18],
  );
  const porCliente = new Map();
  for (const r of rows) {
    const k = r.cliente_id;
    if (!porCliente.has(k)) porCliente.set(k, { codigo: r.codigo_cliente, nome: r.nome, itens: [] });
    porCliente.get(k).itens.push(r);
  }
  console.log(`  ${rows.length} lançamento(s) migráveis de ${porCliente.size} cliente(s).`);
  console.log(`  Ficam na conta 18 (precisam conferência/vínculo): ${ficam[0].sem_vinculo ?? 0} sem cliente, ${ficam[0].com_grupo ?? 0} com grupo antigo.`);
  let feitos = 0;
  for (const [clienteId, info] of porCliente) {
    const saldo = info.itens.reduce((s, r) => s + (r.natureza === 'CREDITO' ? 1 : -1) * Number(r.valor), 0);
    console.log(`  — cliente ${info.codigo ?? clienteId} ${String(info.nome ?? '').slice(0, 40)}: ${info.itens.length} lanç., saldo ${brl(saldo)}`);
    await processarEmLote(ctx, info.itens, `cliente ${clienteId}`, (r) => migrarLancamento(ctx, r.id));
    feitos += info.itens.length;
  }
  console.log(`  ${ctx.executar ? 'Migrados' : '[dry-run] migraria'}: ${feitos}.`);
}

async function etapaGruposZerados(ctx) {
  console.log('\n== grupos-zerados — espelho completo dos grupos legados soma zero (conta 18 × banco real) ==');
  const [membros] = await ctx.db.query(
    `SELECT g.grupo_compensacao grupo, g.id, cb.numero_banco, g.natureza, g.valor,
            g.data_lancamento, g.data_competencia, g.descricao, g.conta_contabil_id, g.cliente_id
     FROM financeiro_lancamento g
     JOIN conta_bancaria cb ON cb.id = g.conta_bancaria_id
     WHERE g.status = 'ATIVO' AND g.grupo_compensacao IN (
       SELECT fl.grupo_compensacao FROM financeiro_lancamento fl
       JOIN conta_bancaria cb2 ON cb2.id = fl.conta_bancaria_id
       WHERE cb2.numero_banco = ? AND fl.status = 'ATIVO' AND fl.grupo_compensacao IS NOT NULL)
     ORDER BY g.grupo_compensacao, g.id`,
    [CONTA_18],
  );
  const porGrupo = new Map();
  for (const m of membros) {
    if (!porGrupo.has(m.grupo)) porGrupo.set(m.grupo, []);
    porGrupo.get(m.grupo).push(m);
  }
  const elegiveis = [];
  const ficam = { residuo: 0, comCliente: 0, parcial19: 0 };
  for (const [grupo, itens] of porGrupo) {
    const soma = itens.reduce((s, r) => s + (r.natureza === 'CREDITO' ? 1 : -1) * Number(r.valor), 0);
    if (Math.abs(round2(soma)) >= 0.005) {
      ficam.residuo += 1;
      continue;
    }
    if (itens.some((r) => r.cliente_id != null)) {
      ficam.comCliente += 1; // inclui os 4 grupos da SE77E — não tocar (decisão do usuário)
      continue;
    }
    if (itens.some((r) => r.numero_banco === NUMERO_BANCO_CZ)) {
      ficam.parcial19 += 1;
      continue;
    }
    elegiveis.push({ grupo, itens });
  }
  const lado18 = elegiveis.flatMap((g) => g.itens.filter((r) => r.numero_banco === CONTA_18));
  const reais = elegiveis.flatMap((g) => g.itens.filter((r) => r.numero_banco !== CONTA_18));
  const somaDe = (xs) => xs.reduce((s, r) => s + (r.natureza === 'CREDITO' ? 1 : -1) * Number(r.valor), 0);
  console.log(
    `  ${porGrupo.size} grupos legados na conta 18 · elegíveis ${elegiveis.length} · ficam: ${ficam.residuo} com resíduo, ${ficam.comCliente} com cliente (SE77E — não tocar), ${ficam.parcial19} parciais na 19.`,
  );
  const [gruposCz] = await ctx.db.query(
    `SELECT DISTINCT grupo_compensacao g FROM financeiro_lancamento WHERE grupo_compensacao LIKE 'CZ18-%'`,
  );
  const gruposFeitos = new Set(gruposCz.map((r) => r.g));
  if (gruposFeitos.size === 0) {
    conferir('grupos zerados (nº de grupos)', elegiveis.length, AUDIT.gzGrupos, 0, 0);
    conferir('lado conta 18', lado18.length, AUDIT.gzQtd18, somaDe(lado18), AUDIT.gzSoma18);
    conferir('lado banco real', reais.length, AUDIT.gzQtdReal, somaDe(reais), AUDIT.gzSomaReal);
  } else {
    console.log(`  Retomada: ${gruposFeitos.size} grupos CZ18-* já existem; conferência estrita da 1ª passada pulada.`);
    if (elegiveis.length + gruposFeitos.size !== AUDIT.gzGrupos) {
      console.warn(
        `  ATENÇÃO: ${elegiveis.length} elegíveis + ${gruposFeitos.size} feitos ≠ ${AUDIT.gzGrupos} do plano — há grupo(s) em estado parcial (espelho/migração sem pareamento). Conferir manualmente via descricao_detalhada 'grupo legado'.`,
      );
    }
  }

  const escritorioId = await garantirPessoaEscritorio(ctx);
  // ids já existentes dos espelhos CZ-M18 (retomada após execução parcial)
  const [espelhosExistentes] = await ctx.db.query(
    `SELECT numero_lancamento, id FROM financeiro_lancamento WHERE numero_lancamento LIKE 'CZ-M18-%' AND status='ATIVO'`,
  );
  const espelhoId = new Map(espelhosExistentes.map((r) => [r.numero_lancamento, r.id]));

  await processarEmLote(ctx, elegiveis, 'grupos-zerados', async ({ grupo, itens }) => {
    const alvo = `CZ18-${grupo}`;
    if (gruposFeitos.has(alvo)) {
      ctx.stats.pulados += itens.length;
      return;
    }
    const m18 = itens.filter((r) => r.numero_banco === CONTA_18);
    const mReais = itens.filter((r) => r.numero_banco !== CONTA_18);
    if (!ctx.executar) {
      // espelhos + migrações + limpezas + 1 pareamento
      ctx.stats.criariam += mReais.length * 2 + m18.length + 1;
      return;
    }
    // 1. espelhos do lado banco-real na conta 19
    const idsGrupo = [];
    for (const r of mReais) {
      const numero = `CZ-M18-${r.id}`;
      if (espelhoId.has(numero)) {
        idsGrupo.push(espelhoId.get(numero));
        ctx.stats.pulados += 1;
        continue;
      }
      const criado = await apiSend(ctx, 'POST', '/api/financeiro/lancamentos', {
        contaContabilId: r.conta_contabil_id,
        clienteId: null,
        processoId: null,
        pessoaRefId: escritorioId,
        bancoNome: BANCO_NOME_CZ,
        numeroBanco: NUMERO_BANCO_CZ,
        numeroLancamento: numero,
        dataLancamento: String(r.data_lancamento).slice(0, 10),
        dataCompetencia: String(r.data_competencia ?? r.data_lancamento).slice(0, 10),
        descricao: String(r.descricao ?? '').slice(0, 500) || `Espelho ${r.id}`,
        descricaoDetalhada: `Espelho do lançamento ${r.id} (banco ${r.numero_banco}, grupo legado ${grupo}) — conciliação interna migrada da conta 18`,
        valor: round2(Number(r.valor)),
        natureza: r.natureza,
        refTipo: 'N',
        origem: ORIGEM_ESPELHO_M18,
        status: 'ATIVO',
      });
      espelhoId.set(numero, criado.id);
      idsGrupo.push(criado.id);
      ctx.stats.criados += 1;
    }
    // 2. migra o lado conta 18 (limpa o grupo legado; vínculo escritório; letra preservada)
    for (const r of m18) {
      await migrarLancamento(ctx, r.id, { pessoaRefId: escritorioId, limparGrupo: true });
      idsGrupo.push(r.id);
    }
    // 3. limpa o grupo legado no lado banco-real, com anotação
    for (const r of mReais) {
      await limparGrupoLegado(ctx, r.id, alvo);
    }
    // 4. reagrupa DENTRO da conta 19 (valida soma zero exata e mesmo vínculo no backend)
    await apiSend(ctx, 'POST', '/api/financeiro/lancamentos/parear-grupo', {
      lancamentoIds: idsGrupo,
      grupoCompensacao: alvo,
    });
    gruposFeitos.add(alvo);
    ctx.stats.criados += 1;
  });
  console.log(
    `  ${ctx.executar ? 'Processados' : '[dry-run] processaria'}: ${elegiveis.length} grupos (${lado18.length} migrações + ${reais.length} espelhos + ${reais.length} limpezas + ${elegiveis.length} pareamentos).`,
  );
}

async function etapaClientesZerados(ctx) {
  console.log('\n== clientes-zerados — parear o recorte inteiro dos clientes 317/642/882 na conta 19 ==');
  const [rows] = await ctx.db.query(
    `SELECT fl.id, fl.cliente_id, fl.natureza, fl.valor
     FROM financeiro_lancamento fl
     WHERE fl.numero_banco = ? AND fl.status = 'ATIVO' AND fl.cliente_id IN (?)
     ORDER BY fl.cliente_id, fl.id`,
    [NUMERO_BANCO_CZ, CLIENTES_ZERADOS],
  );
  conferir('clientes zerados', rows.length, AUDIT.czQtd, 0, 0);
  for (const clienteId of CLIENTES_ZERADOS) {
    const itens = rows.filter((r) => r.cliente_id === clienteId);
    const soma = itens.reduce((s, r) => s + (r.natureza === 'CREDITO' ? 1 : -1) * Number(r.valor), 0);
    if (Math.abs(round2(soma)) >= 0.005) {
      throw new Error(`Recorte do cliente ${clienteId} não soma zero (${brl(soma)}) — abortado.`);
    }
    const [pend] = await ctx.db.query(
      `SELECT id FROM financeiro_lancamento WHERE numero_banco = ? AND status='ATIVO'
       AND cliente_id = ? AND grupo_compensacao IS NULL`,
      [NUMERO_BANCO_CZ, clienteId],
    );
    if (pend.length === 0) {
      console.log(`  — cliente ${clienteId}: já agrupado, pulando.`);
      ctx.stats.pulados += itens.length;
      continue;
    }
    if (pend.length !== itens.length) {
      throw new Error(`Cliente ${clienteId}: agrupamento parcial detectado — conferir manualmente.`);
    }
    if (!ctx.executar) {
      console.log(`  — cliente ${clienteId}: [dry-run] agruparia ${itens.length} lanç. (soma ${brl(soma)}).`);
      ctx.stats.criariam += 1;
      continue;
    }
    const r = await apiSend(ctx, 'POST', '/api/financeiro/lancamentos/parear-grupo', {
      lancamentoIds: pend.map((p) => p.id),
      grupoCompensacao: `CZ18C-${clienteId}`,
    });
    console.log(`  — cliente ${clienteId}: grupo ${r.grupoCompensacao} (${r.lancamentos} lanç., soma ${brl(r.soma)}).`);
    ctx.stats.criados += 1;
  }
}

async function etapaParesEstritos(ctx) {
  console.log('\n== pares-estritos — 1 crédito × 1 débito (mesmo cliente, mesmo valor) na conta 19 ==');
  const [rows] = await ctx.db.query(
    `SELECT fl.id, fl.cliente_id, fl.natureza, fl.valor
     FROM financeiro_lancamento fl
     WHERE fl.numero_banco = ? AND fl.status = 'ATIVO' AND fl.grupo_compensacao IS NULL
       AND fl.cliente_id IS NOT NULL AND fl.cliente_id NOT IN (?)
       AND fl.descricao_detalhada LIKE '%${MARCA_MIGRACAO}%'
     ORDER BY fl.cliente_id, fl.valor, fl.natureza, fl.id`,
    [NUMERO_BANCO_CZ, CLIENTES_ZERADOS],
  );
  const porChave = new Map();
  for (const r of rows) {
    const k = `${r.cliente_id}|${Number(r.valor).toFixed(2)}`;
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(r);
  }
  const pares = [];
  for (const itens of porChave.values()) {
    const cred = itens.filter((r) => r.natureza === 'CREDITO');
    const deb = itens.filter((r) => r.natureza === 'DEBITO');
    if (cred.length === 1 && deb.length === 1) pares.push({ credito: cred[0], debito: deb[0] });
  }
  const somaPares = pares.reduce((s, p) => s + Number(p.credito.valor), 0);
  conferir('pares estritos', pares.length, AUDIT.parQtd, somaPares, AUDIT.parSoma);
  console.log('  Amostra de conferência (5 primeiros):');
  for (const p of pares.slice(0, 5)) {
    console.log(
      `    cliente ${p.credito.cliente_id} · R$ ${brl(p.credito.valor)} · crédito ${p.credito.id} × débito ${p.debito.id}`,
    );
  }
  const seq = new Map();
  await processarEmLote(ctx, pares, 'pares-estritos', async (p) => {
    const n = (seq.get(p.credito.cliente_id) ?? 0) + 1;
    seq.set(p.credito.cliente_id, n);
    if (!ctx.executar) {
      ctx.stats.criariam += 1;
      return;
    }
    await apiSend(ctx, 'POST', '/api/financeiro/lancamentos/parear-grupo', {
      lancamentoIds: [p.credito.id, p.debito.id],
      grupoCompensacao: `CZ18P-${p.credito.cliente_id}-${n}`,
    });
    ctx.stats.criados += 1;
  });
  console.log(`  ${ctx.executar ? 'Agrupados' : '[dry-run] agruparia'}: ${pares.length} pares (${brl(somaPares)}).`);
}

async function etapaResumo(ctx) {
  console.log('\n== resumo — conta-acerto/resumo (conta 19) ==');
  const r = await apiGet(ctx, `/api/financeiro/conta-acerto/resumo?numeroBanco=${NUMERO_BANCO_CZ}`);
  console.log(`  Lançamentos: ${r.totalLancamentos} (pendentes ${r.totalPendentes})`);
  console.log(`  Soma da conta: ${brl(r.somaConta)} · soma pendente: ${brl(r.somaPendente)}`);
  for (const v of r.vinculos ?? []) {
    console.log(`    ${v.codigoCliente ?? v.pessoaRefId ?? '?'} ${String(v.nome ?? '').slice(0, 45)}: ${v.totalLancamentos} lanç., saldo ${brl(v.saldo)}, pendente ${brl(v.saldoPendente)}`);
  }
  const [c18] = await ctx.db.query(
    `SELECT COUNT(*) qtd, COALESCE(SUM(CASE WHEN natureza='CREDITO' THEN valor ELSE -valor END),0) saldo
     FROM financeiro_lancamento fl JOIN conta_bancaria cb ON cb.id = fl.conta_bancaria_id
     WHERE cb.numero_banco = ? AND fl.status = 'ATIVO'`,
    [CONTA_18],
  );
  console.log(`  Restante na conta 18: ${c18[0].qtd} lançamento(s), saldo ${brl(c18[0].saldo)}.`);
}

// ---------------------------------------------------------------------------

const ETAPAS = {
  'veredas-migracao': etapaVeredasMigracao,
  'veredas-espelhos': etapaVeredasEspelhos,
  'se77e-conta18': etapaSe77eConta18,
  'resto-conta18': etapaRestoConta18,
  'grupos-zerados': etapaGruposZerados,
  'clientes-zerados': etapaClientesZerados,
  'pares-estritos': etapaParesEstritos,
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

  const token = await login(opts.baseUrl);
  const db = await mysql.createConnection({
    host: process.env.VILAREAL_MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.VILAREAL_MYSQL_PORT || 3307),
    user: process.env.VILAREAL_MYSQL_USER || 'root',
    password: process.env.VILAREAL_MYSQL_PASSWORD || 'root',
    database: process.env.VILAREAL_MYSQL_DATABASE || 'vilareal',
    dateStrings: true,
  });
  const ctx = {
    ...opts,
    token,
    db,
    existentesCz: new Set(),
    stats: { criados: 0, criariam: 0, pulados: 0 },
  };
  try {
    const [existentes] = await db.query(
      `SELECT numero_lancamento FROM financeiro_lancamento WHERE numero_banco = ? AND status='ATIVO'`,
      [NUMERO_BANCO_CZ],
    );
    for (const r of existentes) ctx.existentesCz.add(r.numero_lancamento);
    console.log(`Conta 19 tem ${ctx.existentesCz.size} lançamento(s) ativos.`);

    for (const e of etapas) await ETAPAS[e](ctx);

    console.log(
      `\nFim. ${opts.executar ? 'Processados' : 'Processariam'}: ${opts.executar ? ctx.stats.criados : ctx.stats.criariam} · pulados (já feitos): ${ctx.stats.pulados}`,
    );
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(`ERRO: ${e.message}`);
  process.exit(1);
});
