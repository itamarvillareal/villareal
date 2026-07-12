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
 *   planilha-grupos  — item 5 da FASE 2: fecha o restante da conta 18 pelos blocos de soma zero da
 *                      aba "LANÇ MANUAIS (2)" da planilha (delimitados pela soma acumulada voltar a
 *                      zero; chave de cruzamento = id da linha no início da descricao_detalhada +
 *                      valor assinado). Migra os lançamentos da 18, agrupa com os pendentes da 19,
 *                      cria espelhos das linhas ausentes do sistema (CZ-P18-{rowId}) e espelhos de
 *                      fechamento (CZ-P18F-{id}) para membros já presos em grupos CZ18-*.
 *                      Vínculo do bloco: cliente existente nos membros > REF. INTERNA 01 numérica
 *                      (codigo_cliente) > pessoa escritório. Os 5 lançamentos MARESSA x BEATRIZ
 *                      (linhas 11819–11826) ficam na 18 como pendentes legítimos.
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
import XLSX from 'xlsx';
import { requireExtratoBancosPlanilhaXlsPath } from './lib/resolve-extrato-bancos-planilha-xls.mjs';
import { excelSerialParaISO } from './lib/extrato-bancos-planilha-parse.mjs';

const NUMERO_BANCO_CZ = 19;
const BANCO_NOME_CZ = 'CONTA ZERO';
const CONTA_18 = 18;
const CLIENTE_VEREDAS = 493;
const CLIENTE_SE77E = 729;
const CONTA_CONTABIL_D = 4; // Conta Veredas
const MARCA_MIGRACAO = 'migrado da conta 18';
const ORIGEM_ESPELHO = 'CARGA-CZ-VEREDAS';
const ORIGEM_ESPELHO_M18 = 'MIGRACAO-CZ-18';
const ORIGEM_ESPELHO_PLANILHA = 'MIGRACAO-CZ-18-PLANILHA';
const PESSOA_ESCRITORIO_NOME = 'ESCRITORIO - CONCILIACOES INTERNAS (CONTA ZERO)';
const CLIENTES_ZERADOS = [317, 642, 882];
const ABA_PLANILHA_18 = 'LANÇ MANUAIS (2)';
// Auditoria do item 5 (validada em 11/07 contra planilha + banco local). As 15 linhas fora de
// bloco são o caso MARESSA x BEATRIZ; os 5 sem match na conta 18 são os mesmos lançamentos.
const AUDIT_PLANILHA = {
  blocos: 1237,
  linhasForaBloco: 15,
  conta18SemMatch: 5,
  migracoes18: 1590, // 1.559 em blocos fecháveis + 31 em blocos de clientes mistos
  espelhosAusentes: 36,
  espelhosFechamento: 316, // só blocos fecháveis (blocos mistos não criam espelhos)
  blocosPendentes: 841, // 833 fecháveis + 8 com clientes mistos (migram sem grupo)
};
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

/** Lê a aba LANÇ MANUAIS (2) e delimita os blocos de soma zero (soma acumulada em centavos). */
function lerBlocosPlanilha() {
  const caminho = requireExtratoBancosPlanilhaXlsPath(null);
  const wb = XLSX.readFile(caminho, { cellDates: false });
  const nomeAba = wb.SheetNames.find(
    (n) => n.trim().toUpperCase() === ABA_PLANILHA_18.toUpperCase(),
  );
  if (!nomeAba) throw new Error(`Aba "${ABA_PLANILHA_18}" não encontrada em ${caminho}`);
  const ws = wb.Sheets[nomeAba];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })]?.v;
  const linhas = [];
  for (let r = 6; r <= range.e.r; r += 1) {
    const valor = cell(r, 7); // col H — valor assinado
    const rowId = cell(r, 4); // col E — id da linha (prefixo da descricao_detalhada)
    if (typeof valor !== 'number' || !Number.isFinite(valor)) continue;
    if (typeof rowId !== 'number') continue;
    linhas.push({
      rowId,
      cents: Math.round(valor * 100),
      letra: String(cell(r, 1) ?? '').trim().toUpperCase(),
      dataIso: excelSerialParaISO(cell(r, 3)),
      descricao: String(cell(r, 6) ?? '').trim(),
      comentario: String(cell(r, 9) ?? '').trim(),
      ref01: cell(r, 11), // REFERÊNCIA INTERNA 01 — numérica = codigo_cliente
    });
  }
  const blocos = [];
  let atual = [];
  let soma = 0;
  for (const l of linhas) {
    atual.push(l);
    soma += l.cents;
    if (soma === 0) {
      blocos.push(atual);
      atual = [];
    }
  }
  return { caminho, blocos, foraDeBloco: atual, totalLinhas: linhas.length };
}

async function etapaPlanilhaGrupos(ctx) {
  console.log('\n== planilha-grupos — fechar o restante da conta 18 pelos blocos da planilha ==');
  const { caminho, blocos, foraDeBloco } = lerBlocosPlanilha();
  console.log(`  Planilha: ${caminho}`);
  console.log(`  ${blocos.length} blocos de soma zero · ${foraDeBloco.length} linhas fora de bloco (MARESSA x BEATRIZ).`);
  if (blocos.length !== AUDIT_PLANILHA.blocos || foraDeBloco.length !== AUDIT_PLANILHA.linhasForaBloco) {
    throw new Error(
      `Delimitação divergiu da auditoria (${AUDIT_PLANILHA.blocos} blocos / ${AUDIT_PLANILHA.linhasForaBloco} fora) — planilha mudou? Abortado.`,
    );
  }
  for (const b of blocos) {
    if (b.reduce((s, l) => s + l.cents, 0) !== 0) {
      throw new Error(`Bloco iniciado na linha ${b[0].rowId} não soma zero — abortado.`);
    }
  }

  // Lançamentos das contas 18/19 com o id da linha no início da descricao_detalhada
  const [rows] = await ctx.db.query(
    `SELECT fl.id, cb.numero_banco nb, fl.grupo_compensacao grupo, fl.cliente_id, fl.pessoa_ref_id,
            fl.natureza, fl.valor, fl.conta_contabil_id, fl.data_lancamento, fl.data_competencia,
            fl.descricao, CAST(fl.descricao_detalhada AS CHAR) det
     FROM financeiro_lancamento fl JOIN conta_bancaria cb ON cb.id = fl.conta_bancaria_id
     WHERE fl.status = 'ATIVO' AND cb.numero_banco IN (?, ?)
       AND fl.descricao_detalhada REGEXP '^[0-9]+'`,
    [CONTA_18, NUMERO_BANCO_CZ],
  );
  const porChave = new Map();
  for (const r of rows) {
    const m = String(r.det).match(/^(\d+)/);
    if (!m) continue;
    const signed = (r.natureza === 'CREDITO' ? 1 : -1) * Math.round(Number(r.valor) * 100);
    const k = `${Number(m[1])}|${signed}`;
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(r);
  }
  const consumidos = new Set();
  const matchLinha = (l) => {
    const cands = (porChave.get(`${l.rowId}|${l.cents}`) ?? []).filter((c) => !consumidos.has(c.id));
    if (!cands.length) return null;
    const c = cands.find((x) => x.nb === CONTA_18) ?? cands[0];
    consumidos.add(c.id);
    return c;
  };

  // contas contábeis (letra → id) e clientes (codigo_cliente → id)
  const [ccRows] = await ctx.db.query(`SELECT id, codigo FROM financeiro_conta_contabil`);
  const contaPorLetra = new Map(ccRows.map((r) => [r.codigo, r.id]));
  const [cliRows] = await ctx.db.query(`SELECT id, codigo_cliente FROM cliente`);
  const clientePorCodigo = new Map(
    cliRows.map((r) => [Number(String(r.codigo_cliente).replace(/\D/g, '')), r.id]),
  );

  // espelhos já criados (retomada) — espelho sem grupo indica bloco parcialmente processado
  const [espelhosExistentes] = await ctx.db.query(
    `SELECT numero_lancamento, id, grupo_compensacao grupo FROM financeiro_lancamento
     WHERE (numero_lancamento LIKE 'CZ-P18-%' OR numero_lancamento LIKE 'CZ-P18F-%') AND status='ATIVO'`,
  );
  const espelhoId = new Map(espelhosExistentes.map((r) => [r.numero_lancamento, r.id]));
  const espelhosSemGrupo = new Set(
    espelhosExistentes.filter((r) => !r.grupo).map((r) => r.numero_lancamento),
  );

  // classifica os blocos
  const pendentes = [];
  const mistos = [];
  let semPendencia = 0;
  for (const b of blocos) {
    const membros = b.map((l) => ({ l, r: matchLinha(l) }));
    const na18 = membros.filter((m) => m.r?.nb === CONTA_18);
    const pend19 = membros.filter((m) => m.r?.nb === NUMERO_BANCO_CZ && !m.r.grupo);
    const presos19 = membros.filter((m) => m.r?.nb === NUMERO_BANCO_CZ && m.r.grupo);
    const ausentes = membros.filter((m) => !m.r);
    // Bloco parcialmente processado numa execução anterior (espelho criado, grupo não formado):
    // os antigos "na18" já estarão na 19 como pend19 — retomar e fechar.
    const temEspelhoOrfao =
      ausentes.some((m) => espelhosSemGrupo.has(`CZ-P18-${m.l.rowId}`)) ||
      presos19.some((m) => espelhosSemGrupo.has(`CZ-P18F-${m.r.id}`)) ||
      pend19.some((m) => String(m.r.det ?? '').includes('espelho de fechamento'));
    if (!na18.length && !ausentes.length && !temEspelhoOrfao) {
      semPendencia += 1;
      continue;
    }
    // vínculo do bloco: cliente único existente > REF. INTERNA 01 numérica > pessoa escritório
    const clientes = new Set(membros.map((m) => m.r?.cliente_id).filter(Boolean));
    let vinculo = null;
    if (clientes.size > 1) {
      mistos.push({ b, na18, clientes: [...clientes] });
      continue;
    }
    if (clientes.size === 1) {
      vinculo = { clienteId: [...clientes][0] };
    } else {
      const refs = new Set(
        b.map((l) => (typeof l.ref01 === 'number' && Number.isFinite(l.ref01) ? Math.trunc(l.ref01) : null))
          .filter((x) => x != null),
      );
      const clienteRef = refs.size === 1 ? clientePorCodigo.get([...refs][0]) : null;
      vinculo = clienteRef ? { clienteId: clienteRef } : { pessoaRefId: null }; // escritório, resolvido adiante
    }
    pendentes.push({ b, membros, na18, pend19, presos19, ausentes, vinculo });
  }

  const totais = {
    mig18: pendentes.reduce((s, x) => s + x.na18.length, 0),
    mig18ComGrupo: pendentes.reduce((s, x) => s + x.na18.filter((m) => m.r.grupo).length, 0),
    reagrupa19: pendentes.reduce((s, x) => s + x.pend19.length, 0),
    espAusentes: pendentes.reduce((s, x) => s + x.ausentes.length, 0),
    espFechamento: pendentes.reduce((s, x) => s + x.presos19.length, 0),
    mistos18: mistos.reduce((s, x) => s + x.na18.length, 0),
  };
  console.log(
    `  Blocos: ${pendentes.length} a fechar · ${semPendencia} sem pendência · ${mistos.length} com clientes mistos (só migram, sem grupo).`,
  );
  console.log(
    `  Ações: ${totais.mig18} migrações da 18 (${totais.mig18ComGrupo} limpam grupo legado) + ${totais.mistos18} migrações de blocos mistos · ${totais.reagrupa19} pendentes da 19 reagrupam · ${totais.espAusentes} espelhos de linhas ausentes · ${totais.espFechamento} espelhos de fechamento.`,
  );

  const [gruposCz] = await ctx.db.query(
    `SELECT DISTINCT grupo_compensacao g FROM financeiro_lancamento WHERE grupo_compensacao LIKE 'CZ18B-%'`,
  );
  const gruposFeitos = new Set(gruposCz.map((r) => r.g));
  if (gruposFeitos.size === 0) {
    conferir('blocos pendentes', pendentes.length + mistos.length, AUDIT_PLANILHA.blocosPendentes, 0, 0);
    conferir('migrações da 18', totais.mig18 + totais.mistos18, AUDIT_PLANILHA.migracoes18, 0, 0);
    conferir('espelhos ausentes', totais.espAusentes, AUDIT_PLANILHA.espelhosAusentes, 0, 0);
    conferir('espelhos fechamento', totais.espFechamento, AUDIT_PLANILHA.espelhosFechamento, 0, 0);
  } else {
    console.log(`  Retomada: ${gruposFeitos.size} blocos CZ18B-* já pareados; conferência estrita da 1ª passada pulada.`);
  }

  // relatório dos espelhos (Categoria C do plano — conferência manual)
  console.log('\n  Espelhos de linhas ausentes do sistema:');
  for (const p of pendentes) {
    for (const m of p.ausentes) {
      console.log(
        `    linha ${m.l.rowId} [${m.l.letra || '?'}] ${m.l.dataIso ?? 's/ data'} ${brl(m.l.cents / 100)} — ${(m.l.descricao || m.l.comentario).slice(0, 60)}`,
      );
    }
  }
  const fechAltos = pendentes
    .flatMap((p) => p.presos19.map((m) => ({ m, p })))
    .filter(({ m }) => Math.abs(m.l.cents) >= 100000);
  console.log(`  Espelhos de fechamento com |valor| ≥ R$ 1.000 (${fechAltos.length} de ${totais.espFechamento}):`);
  for (const { m } of fechAltos.slice(0, 40)) {
    console.log(
      `    linha ${m.l.rowId} ${brl(m.l.cents / 100)} — ${String(m.r.descricao ?? '').slice(0, 50)} (preso em ${m.r.grupo})`,
    );
  }
  if (fechAltos.length > 40) console.log(`    … +${fechAltos.length - 40}`);
  if (mistos.length) {
    console.log('  Blocos com clientes mistos (membros migram sem grupo, ficam pendentes):');
    for (const x of mistos) {
      console.log(`    linhas ${x.b[0].rowId}–${x.b.at(-1).rowId}: clientes ${x.clientes.join(', ')}`);
    }
  }

  const escritorioId = await garantirPessoaEscritorio(ctx);

  const criarEspelho = async (numero, body) => {
    if (espelhoId.has(numero)) {
      ctx.stats.pulados += 1;
      return espelhoId.get(numero);
    }
    const criado = await apiSend(ctx, 'POST', '/api/financeiro/lancamentos', { ...body, numeroLancamento: numero });
    espelhoId.set(numero, criado.id);
    ctx.stats.criados += 1;
    return criado.id;
  };

  // Concorrência 1: um grupo legado (letra E) pode ter membros em blocos diferentes; o PUT que
  // limpa o grupo recalcula a etapa de TODOS os membros do grupo legado no backend e, em paralelo,
  // sobrescreve a migração de outro worker (lost update observado no lançamento 165174).
  const ctxSerial = { ...ctx, concurrency: 1 };
  await processarEmLote(ctxSerial, pendentes, 'planilha-grupos', async (p) => {
    const alvo = `CZ18B-${p.b[0].rowId}`;
    if (gruposFeitos.has(alvo)) {
      ctx.stats.pulados += p.membros.length;
      return;
    }
    if (!ctx.executar) {
      ctx.stats.criariam += p.na18.length + p.ausentes.length + p.presos19.length + 1;
      return;
    }
    const vinc = p.vinculo.clienteId
      ? { clienteId: p.vinculo.clienteId, pessoaRefId: null }
      : { clienteId: null, pessoaRefId: escritorioId };
    const idsGrupo = [];
    // 1. migra o lado conta 18 (aplica o vínculo do bloco; limpa grupo legado se houver)
    for (const m of p.na18) {
      await migrarLancamento(ctx, m.r.id, { ...vinc, limparGrupo: Boolean(m.r.grupo) });
      idsGrupo.push(m.r.id);
    }
    // 2. pendentes da 19 entram no grupo como estão (já têm o vínculo do bloco)
    for (const m of p.pend19) idsGrupo.push(m.r.id);
    // 3. espelhos das linhas que só existem na planilha
    for (const m of p.ausentes) {
      const id = await criarEspelho(`CZ-P18-${m.l.rowId}`, {
        contaContabilId: contaPorLetra.get(m.l.letra) ?? contaPorLetra.get('N'),
        ...vinc,
        processoId: null,
        bancoNome: BANCO_NOME_CZ,
        numeroBanco: NUMERO_BANCO_CZ,
        dataLancamento: m.l.dataIso ?? p.b.find((l) => l.dataIso)?.dataIso ?? '2017-01-01',
        dataCompetencia: m.l.dataIso ?? p.b.find((l) => l.dataIso)?.dataIso ?? '2017-01-01',
        descricao: (m.l.descricao || m.l.comentario || `Linha ${m.l.rowId} da planilha`).slice(0, 500),
        descricaoDetalhada: `${m.l.rowId} · espelho da linha ${m.l.rowId} da planilha LANÇ MANUAIS (2) — membro ausente do sistema${m.l.comentario ? ` · ${m.l.comentario}` : ''}`.slice(0, 2000),
        valor: round2(Math.abs(m.l.cents) / 100),
        natureza: m.l.cents >= 0 ? 'CREDITO' : 'DEBITO',
        refTipo: 'N',
        origem: ORIGEM_ESPELHO_PLANILHA,
        status: 'ATIVO',
      });
      idsGrupo.push(id);
    }
    // 4. espelhos de fechamento: o membro já está compensado num grupo CZ18-* (lançamento-ponte
    //    participa de duas conciliações); o espelho fecha o bloco sem tocar no grupo existente
    for (const m of p.presos19) {
      const id = await criarEspelho(`CZ-P18F-${m.r.id}`, {
        contaContabilId: m.r.conta_contabil_id,
        ...vinc,
        processoId: null,
        bancoNome: BANCO_NOME_CZ,
        numeroBanco: NUMERO_BANCO_CZ,
        dataLancamento: String(m.r.data_lancamento).slice(0, 10),
        dataCompetencia: String(m.r.data_competencia ?? m.r.data_lancamento).slice(0, 10),
        descricao: String(m.r.descricao ?? '').slice(0, 500) || `Fechamento linha ${m.l.rowId}`,
        descricaoDetalhada: `${m.l.rowId} · espelho de fechamento do lançamento ${m.r.id} (já conciliado em ${m.r.grupo}) — bloco da planilha`,
        valor: round2(Math.abs(m.l.cents) / 100),
        natureza: m.l.cents >= 0 ? 'CREDITO' : 'DEBITO',
        refTipo: 'N',
        origem: ORIGEM_ESPELHO_PLANILHA,
        status: 'ATIVO',
      });
      idsGrupo.push(id);
    }
    // 5. pareia o bloco (backend valida soma zero exata e mesmo vínculo)
    if (idsGrupo.length >= 2) {
      await apiSend(ctx, 'POST', '/api/financeiro/lancamentos/parear-grupo', {
        lancamentoIds: idsGrupo,
        grupoCompensacao: alvo,
      });
      ctx.stats.criados += 1;
    } else {
      console.log(`  Bloco ${alvo} com ${idsGrupo.length} lançamento(s) — migrado sem parear.`);
    }
    gruposFeitos.add(alvo);
  });

  // blocos mistos: migram sem grupo e sem mudar vínculo (sem cliente → escritório)
  await processarEmLote(ctx, mistos.flatMap((x) => x.na18), 'planilha-mistos', async (m) => {
    await migrarLancamento(ctx, m.r.id, {
      ...(m.r.cliente_id ? {} : { pessoaRefId: escritorioId }),
      limparGrupo: Boolean(m.r.grupo),
    });
  });

  console.log(
    `  ${ctx.executar ? 'Processados' : '[dry-run] processaria'}: ${pendentes.length} blocos + ${totais.mistos18} lançamentos de blocos mistos.`,
  );
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
  'planilha-grupos': etapaPlanilhaGrupos,
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
