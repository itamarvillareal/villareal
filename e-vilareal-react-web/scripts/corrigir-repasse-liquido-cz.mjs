/**
 * Corrige contrapartidas CZ-REP + CZ-HON: uma única saída líquida ao cliente (sem linha de honorários).
 *
 * Antes: DEBITO repasse valor cheio + CREDITO honorários 20% (confuso na Conta Corrente).
 * Depois: DEBITO repasse líquido (80%) + CZ-HON aposentado.
 *
 * Uso:
 *   node scripts/corrigir-repasse-liquido-cz.mjs
 *   node scripts/corrigir-repasse-liquido-cz.mjs --executar
 */

import './lib/load-vilareal-import-env.mjs';
import mysql from 'mysql2/promise';

const NUMERO_BANCO_CZ = 19;

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

function round2(n) {
  return Math.round(n * 100) / 100;
}

function brl(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function login(baseUrl) {
  const loginUser = (process.env.VILAREAL_IMPORT_LOGIN || 'itamar').trim().toLowerCase();
  const senha = process.env.VILAREAL_IMPORT_SENHA || '';
  if (!senha) throw new Error('Defina VILAREAL_IMPORT_SENHA.');
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginUser, senha }),
  });
  if (!res.ok) throw new Error(`Login falhou ${res.status}`);
  const j = await res.json();
  return j.accessToken;
}

async function apiGet(token, baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return res.json();
}

async function apiPut(token, baseUrl, id, body) {
  const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${id}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function bodyFromAtual(atual, patch) {
  return {
    contaContabilId: atual.contaContabilId,
    clienteId: atual.clienteId ?? null,
    processoId: atual.processoId ?? null,
    pessoaRefId: atual.pessoaRefId ?? null,
    bancoNome: atual.bancoNome,
    numeroBanco: atual.numeroBanco,
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
    visivelCliente: atual.visivelCliente ?? true,
    valorCliente: atual.valorCliente ?? null,
    grupoCompensacao: atual.grupoCompensacao ?? null,
    ...patch,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const db = await mysql.createConnection({
    host: process.env.VILAREAL_IMPORT_DB_HOST || '127.0.0.1',
    port: Number(process.env.VILAREAL_IMPORT_DB_PORT || 3307),
    user: process.env.VILAREAL_IMPORT_DB_USER || 'root',
    password: process.env.VILAREAL_IMPORT_DB_PASSWORD || 'root',
    database: process.env.VILAREAL_IMPORT_DB_NAME || 'vilareal',
  });

  const [hons] = await db.query(
    `SELECT id, numero_lancamento, valor, natureza
     FROM financeiro_lancamento
     WHERE status='ATIVO' AND numero_banco=? AND (
       numero_lancamento LIKE 'CZ-HON-%' OR numero_lancamento LIKE 'CZ-DEVHON-%'
     )`,
    [NUMERO_BANCO_CZ],
  );

  console.log(`${hons.length} linha(s) CZ-HON / CZ-DEVHON a aposentar.`);

  const token = await login(args.baseUrl);
  const stats = { repAtualizados: 0, honAposentados: 0, devAtualizados: 0, pulados: 0, erros: 0 };

  for (const hon of hons) {
    const num = String(hon.numero_lancamento);
    const sufixo = num.replace(/^CZ-(HON|DEVHON)-/, '');
    const prefixRep = num.startsWith('CZ-DEVHON-') ? 'CZ-DEV-' : 'CZ-REP-';
    const [reps] = await db.query(
      `SELECT id, numero_lancamento, valor, natureza, descricao
       FROM financeiro_lancamento
       WHERE status='ATIVO' AND numero_banco=? AND numero_lancamento=?`,
      [NUMERO_BANCO_CZ, `${prefixRep}${sufixo}`],
    );
    const rep = reps[0];
    if (!rep) {
      stats.pulados += 1;
      continue;
    }

    const valRep = Number(rep.valor);
    const valHon = Number(hon.valor);
    const liquido = round2(Math.abs(valRep - valHon));
    const isDev = prefixRep === 'CZ-DEV-';

    try {
      if (!args.executar) {
        console.log(
          `[dry-run] ${rep.numero_lancamento}: ${brl(valRep)} → ${brl(liquido)} · aposentar ${num}`,
        );
        stats.repAtualizados += 1;
        stats.honAposentados += 1;
        continue;
      }

      const atualRep = await apiGet(token, args.baseUrl, `/api/financeiro/lancamentos/${rep.id}`);
      const descBase = String(atualRep.descricao ?? '')
        .replace(/^Repasse devido —/i, 'Repasse ao cliente —')
        .replace(/^Estorno de repasse —/i, 'Estorno repasse ao cliente —');
      await apiPut(token, args.baseUrl, rep.id, bodyFromAtual(atualRep, {
        valor: liquido,
        descricao: descBase,
      }));
      stats[isDev ? 'devAtualizados' : 'repAtualizados'] += 1;

      const atualHon = await apiGet(token, args.baseUrl, `/api/financeiro/lancamentos/${hon.id}`);
      await apiPut(token, args.baseUrl, hon.id, bodyFromAtual(atualHon, { status: 'APOSENTADO' }));
      stats.honAposentados += 1;
    } catch (e) {
      stats.erros += 1;
      console.error(`Erro ${num}: ${e.message}`);
    }
  }

  console.log('\nResumo:', stats);
  if (!args.executar) console.log('Use --executar para aplicar.');
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
