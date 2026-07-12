/**
 * Finalização legado contas 9/17/18 → CONTA ZERO (19).
 * - Enriquecimento metadados planilha aba 9 → conta 19 (sem valor)
 * - Resolução conflitos elo (desparear seguro + parear)
 * - Aposentar ATIVO nas contas 9, 17, 18
 * - Desativar conta_bancaria 9/17/18
 *
 * Uso:
 *   node scripts/finalizar-legado-manuais.mjs
 *   node scripts/finalizar-legado-manuais.mjs --executar
 */

import './lib/load-vilareal-import-env.mjs';
import XLSX from 'xlsx';
import { requireExtratoBancosPlanilhaXlsPath } from './lib/resolve-extrato-bancos-planilha-xls.mjs';
import { parseValorPlanilha, normalizarCodigoCliente8 } from './lib/extrato-bancos-planilha-parse.mjs';
import {
  carregarPlanilhaElo,
  mesclarCards,
  classificarCardNoDb,
  carregarLancamentosPorRowIdConta,
  carregarElosCompensacaoDb,
  signedLanc,
} from './lib/resgate-cards-elo.mjs';
import {
  login,
  conectarDb,
  isLocalBackend,
  carregarMapaClientes,
  resolverProcessoId,
  desparearGrupo,
  parearGrupo,
  garantirPessoaEscritorio,
  apiGet,
  apiSend,
  NUMERO_BANCO_CZ,
  PESSOA_ESCRITORIO_NOME,
} from './lib/carga-acerto-api.mjs';

function parseArgs(argv) {
  const out = { executar: false, baseUrl: 'http://localhost:8080', skipAposentar: false };
  for (const a of argv.slice(2)) {
    if (a === '--executar') out.executar = true;
    else if (a === '--skip-aposentar') out.skipAposentar = true;
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else {
      console.error(`Arg desconhecido: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

function rowIdFromDet(det) {
  const m = String(det ?? '').match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function lerMapaPlanilha9() {
  const wb = XLSX.readFile(requireExtratoBancosPlanilhaXlsPath(), { cellDates: false });
  const ws = wb.Sheets['LANÇ MANUAIS'];
  const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })]?.v;
  const map = new Map();
  for (let r = 6; r <= XLSX.utils.decode_range(ws['!ref']).e.r; r += 1) {
    const rowId = cell(r, 4);
    if (typeof rowId !== 'number') continue;
    const codRaw = cell(r, 11);
    const procRaw = cell(r, 12);
    const codigo = normalizarCodigoCliente8(codRaw);
    const proc = Number(procRaw) > 0 && Number(procRaw) < 1000 ? Math.trunc(Number(procRaw)) : null;
    map.set(rowId, { codigo, proc, comentario: String(cell(r, 9) ?? '').trim() });
  }
  return map;
}

async function atualizarMetadados(ctx, db, lancId, { clienteId, processoId }) {
  const atual = await apiGet(ctx, `/api/financeiro/lancamentos/${lancId}`);
  const cid = clienteId ?? atual.clienteId ?? null;
  const pid = processoId ?? atual.processoId ?? null;
  if (!ctx.executar) return { ok: true, dry: true };
  await apiSend(ctx, 'PUT', `/api/financeiro/lancamentos/${lancId}`, {
    contaContabilId: atual.contaContabilId,
    clienteId: cid,
    processoId: pid,
    pessoaRefId: cid ? null : (atual.pessoaRefId ?? null),
    bancoNome: atual.bancoNome,
    numeroBanco: atual.numeroBanco,
    numeroLancamento: atual.numeroLancamento,
    dataLancamento: atual.dataLancamento,
    dataCompetencia: atual.dataCompetencia ?? atual.dataLancamento,
    descricao: atual.descricao,
    descricaoDetalhada: atual.descricaoDetalhada,
    valor: atual.valor,
    natureza: atual.natureza,
    refTipo: atual.refTipo ?? 'N',
    origem: atual.origem ?? 'MANUAL',
    status: atual.status ?? 'ATIVO',
    visivelCliente: atual.visivelCliente ?? true,
    valorCliente: atual.valorCliente ?? null,
    grupoCompensacao: atual.grupoCompensacao ?? null,
  });
  return { ok: true };
}

async function vincularPessoaEscritorio(ctx, db, ids) {
  const pid = await garantirPessoaEscritorio(db, ctx);
  if (!pid) return;
  for (const id of ids) {
    const atual = await apiGet(ctx, `/api/financeiro/lancamentos/${id}`);
    if (atual.clienteId || atual.pessoaRefId) continue;
    if (!ctx.executar) continue;
    await apiSend(ctx, 'PUT', `/api/financeiro/lancamentos/${id}`, {
      contaContabilId: atual.contaContabilId,
      clienteId: null,
      processoId: atual.processoId ?? null,
      pessoaRefId: pid,
      bancoNome: atual.bancoNome,
      numeroBanco: atual.numeroBanco,
      numeroLancamento: atual.numeroLancamento,
      dataLancamento: atual.dataLancamento,
      dataCompetencia: atual.dataCompetencia ?? atual.dataLancamento,
      descricao: atual.descricao,
      descricaoDetalhada: atual.descricaoDetalhada,
      valor: atual.valor,
      natureza: atual.natureza,
      refTipo: atual.refTipo ?? 'N',
      origem: atual.origem ?? 'MANUAL',
      status: atual.status ?? 'ATIVO',
      visivelCliente: atual.visivelCliente ?? true,
      valorCliente: atual.valorCliente ?? null,
      grupoCompensacao: null,
    });
  }
}

async function membrosGrupoDb(db, grupo) {
  const [rows] = await db.query(
    `SELECT id FROM financeiro_lancamento WHERE status='ATIVO' AND grupo_compensacao=?`,
    [grupo],
  );
  return rows.map((r) => r.id);
}

async function resolverConflitosElo(ctx, db, classificados) {
  const candidatos = classificados.filter(
    (c) => c.status === 'CONFLITO' && Math.abs(c.soma19) < 0.005 && c.ids19?.length >= 2,
  );
  let ok = 0;
  let skip = 0;
  let falha = 0;
  for (const c of candidatos) {
    try {
      const idsSet = new Set(c.ids19);
      let seguro = true;
      for (const g of c.grupos ?? []) {
        const membros = await membrosGrupoDb(db, g);
        if (!membros.every((id) => idsSet.has(id))) {
          seguro = false;
          break;
        }
      }
      if (!seguro) {
        skip += 1;
        continue;
      }
      if (!ctx.executar) {
        ok += 1;
        continue;
      }
      for (const g of c.grupos ?? []) await desparearGrupo(ctx, g);
      await vincularPessoaEscritorio(ctx, db, c.ids19);
      await parearGrupo(ctx, c.grupoAlvo, c.ids19);
      ok += 1;
      console.log(`ELO ${c.elo} ${c.grupoAlvo}: pareado`);
    } catch (e) {
      falha += 1;
      console.log(`ELO ${c.elo} FALHA: ${String(e.message ?? e).slice(0, 160)}`);
    }
  }
  return { candidatos: candidatos.length, ok, skip, falha };
}

async function enriquecerMetadados(ctx, db, mapaPlan9, mapaClientes) {
  const [rows] = await db.query(
    `SELECT fl.id, fl.cliente_id, fl.processo_id, CAST(fl.descricao_detalhada AS CHAR) det
     FROM financeiro_lancamento fl
     WHERE fl.numero_banco=? AND fl.status='ATIVO' AND fl.descricao_detalhada REGEXP '^[0-9]+'`,
    [NUMERO_BANCO_CZ],
  );
  let cliente = 0;
  let proc = 0;
  for (const r of rows) {
    const rowId = rowIdFromDet(r.det);
    const p = mapaPlan9.get(rowId);
    if (!p) continue;
    let cid = r.cliente_id;
    let pid = r.processo_id;
    if (!cid && p.codigo) {
      const cod = String(Number.parseInt(p.codigo, 10));
      cid = mapaClientes.get(cod) ?? mapaClientes.get(p.codigo) ?? null;
    }
    if (!pid && p.proc && cid) pid = await resolverProcessoId(db, cid, p.proc);
    if ((!r.cliente_id && cid) || (!r.processo_id && pid)) {
      await atualizarMetadados(ctx, db, r.id, {
        clienteId: cid ?? r.cliente_id,
        processoId: pid ?? r.processo_id,
      });
      if (!r.cliente_id && cid) cliente += 1;
      if (!r.processo_id && pid) proc += 1;
    }
  }
  return { cliente, proc };
}

async function aposentarContas(ctx, db) {
  const contas = [9, 17, 18];
  const stats = {};
  for (const n of contas) {
    const [pre] = await db.query(
      `SELECT COUNT(*) c FROM financeiro_lancamento WHERE numero_banco=? AND status='ATIVO'`,
      [n],
    );
    if (ctx.executar) {
      await db.query(
        `UPDATE financeiro_lancamento SET status='APOSENTADO',
          descricao_detalhada=CONCAT(COALESCE(descricao_detalhada,''), ' · aposentado legado ', DATE(NOW()))
         WHERE numero_banco=? AND status='ATIVO'`,
        [n],
      );
    }
    stats[n] = pre[0].c;
  }
  if (ctx.executar) {
    await db.query(
      `UPDATE conta_bancaria SET ativo=0 WHERE numero_banco IN (9,17,18)`,
    );
  }
  return stats;
}

async function main() {
  const args = parseArgs(process.argv);
  const db = isLocalBackend(args.baseUrl) ? await conectarDb() : null;
  if (!db) throw new Error('Somente backend local suportado.');
  const token = await login(args.baseUrl);
  const ctx = { ...args, token, db };

  console.log('\n== 1) Enriquecimento metadados aba 9 → conta 19 ==');
  const mapaPlan9 = lerMapaPlanilha9();
  const mapaClientes = await carregarMapaClientes(db);
  const enrich = await enriquecerMetadados(ctx, db, mapaPlan9, mapaClientes);
  console.log('Enriquecimento:', enrich, args.executar ? '' : '(dry-run)');

  console.log('\n== 2) Conflitos elo (desparear seguro) ==');
  const { cards9, cards18, compByElo } = carregarPlanilhaElo();
  const cards = mesclarCards(cards9, cards18);
  const porRowId19 = await carregarLancamentosPorRowIdConta(db, NUMERO_BANCO_CZ);
  const porRowId9 = await carregarLancamentosPorRowIdConta(db, 9);
  const elosDb = await carregarElosCompensacaoDb(db);
  const classificados = cards.map((c) => classificarCardNoDb(c, porRowId19, porRowId9, compByElo, elosDb));
  ctx.porRowId = porRowId19;
  const eloRes = await resolverConflitosElo(ctx, db, classificados);
  console.log('Elo conflitos:', eloRes);

  if (!args.skipAposentar) {
    console.log('\n== 3) Aposentar contas 9/17/18 + desativar ==');
    const ap = await aposentarContas(ctx, db);
    console.log('Aposentados:', ap, args.executar ? '' : '(dry-run)');
  }

  const [[c9],[c17],[c18],[cz]] = await Promise.all([
    db.query(`SELECT COUNT(*) n FROM financeiro_lancamento WHERE status='ATIVO' AND numero_banco=9`),
    db.query(`SELECT COUNT(*) n FROM financeiro_lancamento WHERE status='ATIVO' AND numero_banco=17`),
    db.query(`SELECT COUNT(*) n FROM financeiro_lancamento WHERE status='ATIVO' AND numero_banco=18`),
    db.query(`SELECT COUNT(DISTINCT grupo_compensacao) n FROM financeiro_lancamento WHERE status='ATIVO' AND numero_banco=19 AND grupo_compensacao LIKE 'CZ-B%'`),
  ]);
  console.log('\nEstado final:', { ativo9: c9[0].n, ativo17: c17[0].n, ativo18: c18[0].n, czCards: cz[0].n });
  if (!args.executar) console.log('\nUse --executar para aplicar.');

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
