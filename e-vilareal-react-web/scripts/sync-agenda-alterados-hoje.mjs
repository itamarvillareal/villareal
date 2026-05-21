#!/usr/bin/env node
/**
 * Sincroniza agenda na API a partir de ficheiros .txt alterados hoje (ou num dia indicado)
 * em `Banco de Dados/Agenda`.
 *
 * Fluxo:
 *   1. Varre Agenda/{Dr. Itamar|KARLA|Ana Luisa}/… por .txt criados/modificados no dia
 *   2. Separa ficheiros **estruturados** (*.Hora|Compromisso|Status.Agenda.txt) e **dia-legado** (dd.mm.yyyy.txt)
 *   3. Agrupa por utilizador + data (+ linha 1–23 no estruturado)
 *   4. Compara com GET /api/agenda/eventos do dia
 *   5. POST se faltar, PUT se diferir (mesma regra que import-agenda-local-txt.mjs)
 *
 * Uso:
 *   node scripts/sync-agenda-alterados-hoje.mjs
 *   node scripts/sync-agenda-alterados-hoje.mjs --data=2026-05-18 --verbose
 *   node scripts/sync-agenda-alterados-hoje.mjs --aplicar
 *
 * Opções:
 *   --aplicar              Executa POST/PUT (sem isto: dry-run)
 *   --dry-run
 *   --data=YYYY-MM-DD      Dia local (defeito: hoje)
 *   --base-agenda=PATH     Raiz Agenda
 *   --usuario-pasta=       Repetível (ex. "KARLA")
 *   --login= --senha= --base-url=
 *   --concurrency=N
 *   --verbose
 *   --relatorio=JSON
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA, VILAREAL_BANCO_DADOS_BASE
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  USUARIOS_AGENDA_PASTA,
  descricaoComoNaApi,
  resolverBaseAgenda,
} from './lib/agenda-local-txt.mjs';
import {
  aplicarEventosAgenda,
  construirMapaUsuariosPorChave,
  eventoImportavel,
  fetchUsuariosApi,
  jaTemEquivalenteNoLote,
  loginObterToken,
  resolverUsuarioIdPasta,
} from './lib/agenda-api-aplicar.mjs';
import {
  eventosFromScanAgenda,
  inicioDiaLocal,
  parseDiaArg,
  scanAgendaAlteradosNoDia,
} from './lib/agenda-scan-alterados.mjs';

function parseArgs(argv) {
  const out = {
    baseAgenda: resolverBaseAgenda(),
    aplicar: false,
    verbose: false,
    dia: inicioDiaLocal(),
    usuariosPasta: [...USUARIOS_AGENDA_PASTA],
    relatorio: null,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    concurrency: Math.min(
      32,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 8) || 8)
    ),
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--dry-run') out.aplicar = false;
    else if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a.startsWith('--base-agenda=')) out.baseAgenda = a.slice(14);
    else if (a.startsWith('--data=')) out.dia = parseDiaArg(a.slice(7));
    else if (a.startsWith('--usuario-pasta=')) out.usuariosPasta.push(a.slice(16).trim());
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(32, Math.floor(n));
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(opts.baseAgenda)) {
    console.error('Pasta Agenda não encontrada:', opts.baseAgenda);
    process.exit(1);
  }

  const fimDia = new Date(opts.dia);
  fimDia.setDate(fimDia.getDate() + 1);
  const diaLabel = `${opts.dia.getFullYear()}-${String(opts.dia.getMonth() + 1).padStart(2, '0')}-${String(opts.dia.getDate()).padStart(2, '0')}`;

  console.log('\n=== sync-agenda-alterados-hoje ===\n');
  console.log(`Base Agenda: ${opts.baseAgenda}`);
  console.log(`Dia:         ${diaLabel} (fuso local)`);
  console.log(`Modo:        ${opts.aplicar ? 'aplicar (POST/PUT)' : 'dry-run'}`);
  console.log(`Utilizadores: ${opts.usuariosPasta.join(', ')}\n`);

  const scan = scanAgendaAlteradosNoDia(opts.baseAgenda, opts.dia, fimDia, opts.usuariosPasta);
  const eventos = eventosFromScanAgenda(scan);

  console.log(`Ficheiros txt alterados: ${scan.todos.length}`);
  console.log(`  estruturados (.Agenda):  ${scan.estruturados.length}`);
  console.log(`  dia-legado (dd.mm.yyyy): ${scan.diaLegado.length}`);
  console.log(`  outros:                  ${scan.outros.length}`);
  console.log(`  slots estruturados:      ${scan.slotsEstruturados.size}`);
  console.log(`  dias consolidados:       ${scan.ficheirosDia.size}`);
  console.log(`  eventos a avaliar:       ${eventos.length}\n`);

  if (opts.verbose && scan.estruturados.length) {
    console.log('── Estruturados alterados (amostra) ──');
    for (const f of scan.estruturados.slice(0, 40)) {
      console.log(`  ${f.relAposAgenda}`);
    }
    if (scan.estruturados.length > 40) console.log(`  … +${scan.estruturados.length - 40}`);
    console.log('');
  }

  if (eventos.length === 0) {
    console.log('Nenhum evento legível nos ficheiros alterados — nada a sincronizar.');
    process.exit(0);
  }

  if (opts.aplicar && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=... para --aplicar');
    process.exit(1);
  }

  let token = null;
  let usuarioPorChave = null;
  /** @type {object[]} */
  let eventosComId = [];

  if (opts.senha) {
    token = await loginObterToken(opts);
    const listaUsuarios = await fetchUsuariosApi(opts.baseUrl, token);
    const built = construirMapaUsuariosPorChave(listaUsuarios);
    usuarioPorChave = built.map;
    if (built.conflitos.length) {
      console.warn('[warn] Conflitos mapa utilizadores:', built.conflitos.slice(0, 3));
    }

    const semUsuario = [];
    for (const e of eventos) {
      const usuarioId = resolverUsuarioIdPasta(e.usuarioPasta, usuarioPorChave);
      if (usuarioId == null) {
        semUsuario.push(e.usuarioPasta);
        continue;
      }
      eventosComId.push({ ...e, usuarioId });
    }
    if (semUsuario.length) {
      const unicos = [...new Set(semUsuario)];
      console.error('Pastas sem utilizador na API:', unicos.join(', '));
      process.exit(1);
    }
  } else {
    console.log('[aviso] Sem senha — apenas listagem dos eventos (sem API).\n');
    for (const e of eventos.slice(0, 20)) {
      console.log(
        `  ${e.usuarioPasta} ${e.dataEvento} L${e.linhaLegado} | ${e.horaEvento ?? '—'} | ${descricaoComoNaApi(e.descricao).slice(0, 60)}`
      );
    }
    if (eventos.length > 20) console.log(`  … +${eventos.length - 20}`);
    process.exit(0);
  }

  const linhas = [];
  let puladosDupTxt = 0;
  let puladosSemConteudo = 0;

  for (const e of eventosComId) {
    if (!eventoImportavel(e)) {
      puladosSemConteudo += 1;
      continue;
    }
    if (jaTemEquivalenteNoLote(linhas, e)) {
      puladosDupTxt += 1;
      continue;
    }
    linhas.push(e);
  }

  console.log(
    `A sincronizar: ${linhas.length} evento(s) únicos (dup txt=${puladosDupTxt}, sem conteúdo=${puladosSemConteudo})\n`
  );

  const stats = await aplicarEventosAgenda(opts, linhas, token, opts.aplicar, opts.verbose);

  const relatorio = {
    geradoEm: new Date().toISOString(),
    dia: diaLabel,
    baseAgenda: opts.baseAgenda,
    modo: opts.aplicar ? 'aplicar' : 'dry-run',
    scan: {
      ficheiros: scan.todos.length,
      estruturados: scan.estruturados.length,
      diaLegado: scan.diaLegado.length,
      slots: scan.slotsEstruturados.size,
      dias: scan.ficheirosDia.size,
    },
    eventosLidos: eventos.length,
    eventosUnicos: linhas.length,
    stats,
  };

  if (opts.relatorio) {
    const abs = path.resolve(opts.relatorio);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(relatorio, null, 2), 'utf8');
    console.log(`Relatório JSON: ${abs}`);
  }

  console.log('\n=== concluído ===');
  if (opts.aplicar) {
    console.log(
      `Criados: ${stats.criados} | Actualizados: ${stats.puts} | Falhas: ${stats.fail} | Iguais/ambíguos: ${stats.puladosIgual + stats.puladosAmbiguo}\n`
    );
  } else {
    console.log(
      `Dry-run — criar: ${stats.dryRunCriar} | actualizar: ${stats.dryRunAtualizar} | iguais: ${stats.puladosIgual} | ambíguos: ${stats.puladosAmbiguo}\n`
    );
  }

  process.exit(stats.fail > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
