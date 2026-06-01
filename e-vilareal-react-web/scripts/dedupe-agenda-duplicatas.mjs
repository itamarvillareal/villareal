#!/usr/bin/env node
/**
 * Remove duplicatas fuzzy já existentes na API (mantém 1 por grupo equivalente conservador).
 * Dry-run por padrão — só apaga com --aplicar.
 *
 * Uso:
 *   VILAREAL_IMPORT_SENHA='***' node scripts/dedupe-agenda-duplicatas.mjs --todos --login=itamar
 *   node scripts/dedupe-agenda-duplicatas.mjs --data=2026-06-01
 *   node scripts/dedupe-agenda-duplicatas.mjs --data-inicio=2026-01-01 --data-fim=2026-12-31 --aplicar
 */
import process from 'node:process';
import {
  agruparAmbiguosAgenda,
  agruparEquivalentesAgenda,
  escolherKeeperAgenda,
  explicarKeeperAgenda,
  rowParaEventoAgenda,
} from './lib/chaves-dedupe-agenda.mjs';
import { explicarEquivalenciaAgenda } from './lib/agenda-equivalencia-conservadora.mjs';
import { loginObterToken, fetchUsuariosApi } from './lib/agenda-api-aplicar.mjs';

const PERIODO_TODOS_INICIO = '1990-01-01';
const PERIODO_TODOS_FIM = '2099-12-31';

function parseArgs(argv) {
  const out = {
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    data: null,
    dataInicio: null,
    dataFim: null,
    todos: false,
    aplicar: false,
  };
  for (const a of argv) {
    if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--data=')) out.data = a.slice(7);
    else if (a.startsWith('--data-inicio=')) out.dataInicio = a.slice(14);
    else if (a.startsWith('--data-fim=')) out.dataFim = a.slice(11);
    else if (a === '--todos') out.todos = true;
    else if (a === '--aplicar') out.aplicar = true;
  }
  if (out.todos) {
    out.dataInicio = PERIODO_TODOS_INICIO;
    out.dataFim = PERIODO_TODOS_FIM;
  }
  if (out.data) {
    out.dataInicio = out.data;
    out.dataFim = out.data;
  }
  return out;
}

function resumoRow(row) {
  const hora = row.hora_evento ?? '';
  const desc = String(row.descricao ?? '').replace(/\s+/g, ' ').slice(0, 70);
  const ref = row.processo_ref ? ` ref=${row.processo_ref}` : '';
  return `id=${row.id} [${row.origem ?? '?'}] ${hora} ${desc}${ref}`;
}

async function fetchEventosPeriodo(baseUrl, token, dataInicio, dataFim) {
  const q = new URLSearchParams({ dataInicio, dataFim, todosUsuarios: 'true' });
  const r = await fetch(`${baseUrl}/api/agenda/eventos?${q}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`GET agenda: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function excluirEvento(baseUrl, token, id) {
  const r = await fetch(`${baseUrl}/api/agenda/eventos/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`DELETE ${id}: ${r.status}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=...');
    process.exit(1);
  }
  if (!opts.dataInicio || !opts.dataFim) {
    console.error('Informe --data=YYYY-MM-DD, --data-inicio/--data-fim, ou --todos (tabela inteira via API)');
    process.exit(1);
  }

  const token = await loginObterToken(opts);
  await fetchUsuariosApi(opts.baseUrl, token);
  const eventos = await fetchEventosPeriodo(opts.baseUrl, token, opts.dataInicio, opts.dataFim);
  const rows = (Array.isArray(eventos) ? eventos : []).map((e) => ({
    id: e.id,
    usuario_id: e.usuarioId,
    data_evento: e.dataEvento,
    hora_evento: e.horaEvento,
    descricao: e.descricao,
    status_curto: e.statusCurto,
    processo_ref: e.processoRef,
    origem: e.origem,
  }));

  /** @type {Map<string, object[]>} */
  const porDiaUsuario = new Map();
  for (const row of rows) {
    const k = `${row.usuario_id}|${row.data_evento}`;
    if (!porDiaUsuario.has(k)) porDiaUsuario.set(k, []);
    porDiaUsuario.get(k).push(row);
  }

  /** @type {{ cluster: object[], keeper: object, excluir: object[] }[]} */
  const grupos = [];
  /** @type {object[][]} */
  const ambiguos = [];

  for (const [chave, lista] of porDiaUsuario) {
    for (const cluster of agruparEquivalentesAgenda(lista)) {
      const keeper = escolherKeeperAgenda(cluster);
      const excluir = cluster.filter((r) => r.id !== keeper.id);
      grupos.push({ chave, cluster, keeper, excluir });
    }
    for (const cluster of agruparAmbiguosAgenda(lista)) {
      ambiguos.push(cluster);
    }
  }

  const aExcluir = grupos.flatMap((g) => g.excluir);

  console.log(`Modo: ${opts.aplicar ? 'APLICAR (exclusão real)' : 'DRY-RUN (padrão)'}`);
  console.log(`Período ${opts.dataInicio} .. ${opts.dataFim}${opts.todos ? ' (--todos)' : ''}`);
  console.log(`${rows.length} evento(s) lidos, ${grupos.length} grupo(s) dedup, ${aExcluir.length} id(s) a apagar`);
  if (ambiguos.length) {
    console.log(`${ambiguos.length} grupo(s) ambíguo(s) — mantidos sem fundir`);
  }
  console.log('');

  let n = 0;
  for (const { chave, cluster, keeper, excluir } of grupos) {
    n++;
    console.log(`=== Grupo ${n} (${chave}) ===`);
    console.log(`  KEEPER: ${resumoRow(keeper)}`);
    console.log(`  Motivo: ${explicarKeeperAgenda(keeper, cluster)}`);
    for (const row of excluir) {
      const evK = rowParaEventoAgenda(keeper);
      const evR = rowParaEventoAgenda(row);
      console.log(`  APAGAR: ${resumoRow(row)} — ${explicarEquivalenciaAgenda(evK, evR)}`);
    }
    console.log('');
  }

  for (let i = 0; i < ambiguos.length; i++) {
    const cluster = ambiguos[i];
    console.log(`=== Ambíguo ${i + 1} (mantidos) ===`);
    for (const row of cluster) {
      console.log(`  MANTER: ${resumoRow(row)}`);
    }
    console.log('');
  }

  if (!opts.aplicar) {
    console.log('Dry-run concluído. Revise os grupos acima e use --aplicar para excluir as cópias.');
    return;
  }

  for (const row of aExcluir) {
    await excluirEvento(opts.baseUrl, token, row.id);
    console.log(`Excluído id=${row.id}`);
  }
  console.log(`Excluídas ${aExcluir.length} duplicata(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
