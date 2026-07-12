/**
 * Etapa 6 — migração repasse interno: conta virtual 900 → CONTA ZERO (19) com letras I/A.
 *
 * Para cada par AUTO-REP-{aluguelVinculoId}-D / -C na conta 900:
 *   - despareia grupo legado (se houver)
 *   - move débito para conta 19 letra A (preserva pessoa_ref)
 *   - move crédito para conta 19 letra I
 *   - parear-grupo com chave AUTO-REP-{aluguelVinculoId}
 *
 * Idempotente: pares já na 19 com letras corretas e compensados são pulados.
 *
 * Uso (na pasta e-vilareal-react-web):
 *   node scripts/migracao-conta-900-cz.mjs
 *   node scripts/migracao-conta-900-cz.mjs --executar
 */

import './lib/load-vilareal-import-env.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';

const NUMERO_BANCO_CZ = 19;
const BANCO_NOME_CZ = 'CONTA ZERO';
const BANCO_LEGADO = 900;
const MARCA_MIGRACAO = 'migrado da conta 900';
const PREFIXO = 'AUTO-REP-';

function parseArgs(argv) {
  const out = { executar: false, baseUrl: 'http://localhost:8080' };
  for (const a of argv.slice(2)) {
    if (a === '--executar') out.executar = true;
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else {
      console.error(`Argumento desconhecido: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

const brl = (n) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function extrairAluguelVinculoId(numeroLancamento) {
  const m = String(numeroLancamento || '').match(/^AUTO-REP-(\d+)-(D|C)$/);
  return m ? Number(m[1]) : null;
}

async function carregarPares(db) {
  const [rows] = await db.query(`
    SELECT fl.id, fl.numero_lancamento, fl.natureza, fl.numero_banco, fl.conta_contabil_id,
           cc.codigo AS conta_codigo, fl.pessoa_ref_id, fl.valor, fl.grupo_compensacao, fl.etapa
    FROM financeiro_lancamento fl
    JOIN financeiro_conta_contabil cc ON cc.id = fl.conta_contabil_id
    WHERE fl.numero_lancamento LIKE 'AUTO-REP-%'
      AND fl.numero_banco IN (?, ?)
    ORDER BY fl.numero_lancamento
  `, [BANCO_LEGADO, NUMERO_BANCO_CZ]);

  const porVinculo = new Map();
  for (const r of rows) {
    const vid = extrairAluguelVinculoId(r.numero_lancamento);
    if (!vid) continue;
    const slot = porVinculo.get(vid) || { vinculoId: vid, debito: null, credito: null };
    if (String(r.numero_lancamento).endsWith('-D')) slot.debito = r;
    if (String(r.numero_lancamento).endsWith('-C')) slot.credito = r;
    porVinculo.set(vid, slot);
  }
  return [...porVinculo.values()].filter((p) => p.debito && p.credito);
}

async function resolverContasContabeis(db) {
  const [rows] = await db.query(
    `SELECT id, codigo FROM financeiro_conta_contabil WHERE UPPER(codigo) IN ('A', 'I')`,
  );
  const map = new Map();
  for (const r of rows) map.set(String(r.codigo).toUpperCase(), Number(r.id));
  if (!map.has('A') || !map.has('I')) {
    throw new Error('Contas contábeis A e/ou I não encontradas no banco.');
  }
  return map;
}

function parJaCorreto(par) {
  const deb = par.debito;
  const cred = par.credito;
  return (
    Number(deb.numero_banco) === NUMERO_BANCO_CZ &&
    Number(cred.numero_banco) === NUMERO_BANCO_CZ &&
    String(deb.conta_codigo).toUpperCase() === 'A' &&
    String(cred.conta_codigo).toUpperCase() === 'I' &&
    deb.grupo_compensacao &&
    deb.grupo_compensacao === cred.grupo_compensacao &&
    String(deb.etapa || '').toUpperCase() === 'COMPENSADO'
  );
}

async function migrarLancamento(ctx, id, { contaContabilId, limparGrupo = false } = {}) {
  const atual = await apiGet(ctx, `/api/financeiro/lancamentos/${id}`);
  if (Number(atual.numeroBanco) === NUMERO_BANCO_CZ && !contaContabilId && !limparGrupo) {
    ctx.stats.pulados += 1;
    return atual;
  }
  if (!ctx.executar) {
    ctx.stats.migrariam += 1;
    return atual;
  }
  const detalheBase = atual.descricaoDetalhada ?? '';
  const detalhe = detalheBase.includes(MARCA_MIGRACAO)
    ? detalheBase
    : `${detalheBase}${detalheBase ? ' · ' : ''}${MARCA_MIGRACAO}`.slice(0, 2000);
  return apiSend(ctx, 'PUT', `/api/financeiro/lancamentos/${id}`, {
    contaContabilId: contaContabilId ?? atual.contaContabilId,
    clienteId: atual.clienteId ?? null,
    processoId: atual.processoId ?? null,
    pessoaRefId: atual.pessoaRefId ?? null,
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
    origem: atual.origem ?? 'AUTO',
    status: atual.status ?? 'ATIVO',
    visivelCliente: atual.visivelCliente ?? true,
    valorCliente: atual.valorCliente ?? null,
    ...(limparGrupo ? { grupoCompensacao: '' } : {}),
  });
}

async function desparearSeNecessario(ctx, grupo) {
  if (!grupo) return;
  if (!ctx.executar) {
    ctx.stats.despareariam += 1;
    return;
  }
  try {
    await apiSend(ctx, 'DELETE', `/api/financeiro/lancamentos/parear/${encodeURIComponent(grupo)}`);
    ctx.stats.despareados += 1;
  } catch (e) {
    if (!String(e.message).includes('404')) throw e;
  }
}

async function parearPar(ctx, debitoId, creditoId, grupo) {
  if (!ctx.executar) {
    ctx.stats.pareariam += 1;
    return;
  }
  await apiSend(ctx, 'POST', '/api/financeiro/lancamentos/parear-grupo', {
    lancamentoIds: [debitoId, creditoId],
    grupoCompensacao: grupo,
  });
  ctx.stats.pareados += 1;
}

async function main() {
  const args = parseArgs(process.argv);
  const db = await conectarMysqlVilareal();
  const contas = await resolverContasContabeis(db);
  const pares = await carregarPares(db);
  await db.end();

  const ctx = {
    baseUrl: args.baseUrl,
    executar: args.executar,
    token: null,
    stats: {
      totalPares: pares.length,
      jaCorretos: 0,
      migrariam: 0,
      pulados: 0,
      despareariam: 0,
      despareados: 0,
      pareariam: 0,
      pareados: 0,
      semPessoaRef: 0,
      valorTotal: 0,
    },
  };

  console.log(`\n== migração repasse interno 900 → 19 (${args.executar ? 'EXECUTAR' : 'DRY-RUN'}) ==`);
  console.log(`Pares AUTO-REP encontrados: ${pares.length}`);

  if (args.executar) {
    ctx.token = await login(args.baseUrl);
  }

  for (const par of pares) {
    if (parJaCorreto(par)) {
      ctx.stats.jaCorretos += 1;
      continue;
    }
    const valor = Math.abs(Number(par.debito.valor) || 0);
    ctx.stats.valorTotal += valor;

    if (!par.debito.pessoa_ref_id) {
      ctx.stats.semPessoaRef += 1;
      console.warn(`  [pendente] vinculo=${par.vinculoId} sem pessoa_ref no débito id=${par.debito.id}`);
      continue;
    }

    if (!args.executar) {
      ctx.stats.migrariam += 2;
      ctx.stats.pareariam += 1;
      if (par.debito.grupo_compensacao || par.credito.grupo_compensacao) {
        ctx.stats.despareariam += 1;
      }
      continue;
    }

    const grupoNovo = `${PREFIXO}${par.vinculoId}`;
    const grupoLegado = par.debito.grupo_compensacao || par.credito.grupo_compensacao;
    if (grupoLegado && grupoLegado !== grupoNovo) {
      await desparearSeNecessario(ctx, grupoLegado);
    } else if (grupoLegado === grupoNovo) {
      await desparearSeNecessario(ctx, grupoLegado);
    }

    const debMigrado = await migrarLancamento(ctx, par.debito.id, {
      contaContabilId: contas.get('A'),
      limparGrupo: true,
    });
    const credMigrado = await migrarLancamento(ctx, par.credito.id, {
      contaContabilId: contas.get('I'),
      limparGrupo: true,
    });

    const debId = ctx.executar ? par.debito.id : par.debito.id;
    const credId = ctx.executar ? par.credito.id : par.credito.id;
    await parearPar(ctx, debId, credId, grupoNovo);
  }

  const s = ctx.stats;
  console.log('\n-- Resumo --');
  console.log(`  Pares totais:        ${s.totalPares}`);
  console.log(`  Já corretos (19 I/A): ${s.jaCorretos}`);
  console.log(`  A migrar:            ${s.totalPares - s.jaCorretos - s.semPessoaRef}`);
  console.log(`  Sem pessoa_ref:      ${s.semPessoaRef}`);
  console.log(`  Valor dos pares:     R$ ${brl(s.valorTotal)}`);
  if (!args.executar) {
    console.log(`  Migrariam:           ${s.migrariam}`);
    console.log(`  Despareariam:        ${s.despareariam}`);
    console.log(`  Pareariam:           ${s.pareariam}`);
    console.log('\n(dry-run — use --executar para aplicar)\n');
  } else {
    console.log(`  Migrados:            ${s.migrariam}`);
    console.log(`  Despareados:         ${s.despareados}`);
    console.log(`  Pareados:            ${s.pareados}`);
    console.log('\n(aplicado em localhost)\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
