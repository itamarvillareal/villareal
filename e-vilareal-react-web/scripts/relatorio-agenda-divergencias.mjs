#!/usr/bin/env node
/**
 * Relatório de divergências: ficheiros .Agenda.txt vs dd.mm.yyyy.txt na mesma pasta.
 *
 * Uso:
 *   node scripts/relatorio-agenda-divergencias.mjs
 *   node scripts/relatorio-agenda-divergencias.mjs --relatorio=tmp/relatorio-agenda-divergencias.json
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  USUARIOS_AGENDA_PASTA,
  compararEventoComReferenciaDia,
  indexarFicheirosAgenda,
  indexarReferenciaDiaLegado,
  normalizarHoraAgendaTxt,
  normalizarStatusAgendaTxt,
  resolverBaseAgenda,
} from './lib/agenda-local-txt.mjs';
import { readOneLineFile } from './lib/historico-local-txt-paths.mjs';

function parseArgs(argv) {
  const out = {
    baseAgenda: resolverBaseAgenda(),
    relatorio: 'tmp/relatorio-agenda-divergencias.json',
    incluirSemReferencia: false,
  };
  for (const a of argv) {
    if (a.startsWith('--base-agenda=')) out.baseAgenda = a.slice(14);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a === '--incluir-sem-referencia') out.incluirSemReferencia = true;
  }
  return out;
}

function eventoFromGrupo(g) {
  const hora = normalizarHoraAgendaTxt(readOneLineFile(g.paths.Hora));
  const compromisso = readOneLineFile(g.paths.Compromisso);
  const status = normalizarStatusAgendaTxt(readOneLineFile(g.paths.Status));
  if (!hora && !compromisso && !status) return null;
  return {
    usuarioPasta: g.usuarioPasta,
    dataEvento: g.dataIso,
    linhaLegado: g.linha,
    horaEvento: hora,
    descricao: compromisso ? String(compromisso).trim().slice(0, 500) : '',
    statusCurto: status,
    paths: g.paths,
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log('Base:', opts.baseAgenda);
  console.log('A varrer eventos estruturados…\n');

  const t0 = Date.now();
  const { grupos } = indexarFicheirosAgenda(opts.baseAgenda, {
    usuarios: USUARIOS_AGENDA_PASTA,
  });
  const { porDia: referenciaPorDia, ficheirosDia } = indexarReferenciaDiaLegado(opts.baseAgenda, {
    usuarios: USUARIOS_AGENDA_PASTA,
  });

  const divergencias = {
    diferente: [],
    ambiguo: [],
    dia_sem_referencia: [],
  };

  let total = 0;
  let iguais = 0;
  let semReferencia = 0;

  for (const g of grupos.values()) {
    const ev = eventoFromGrupo(g);
    if (!ev) continue;
    total += 1;
    const cmp = compararEventoComReferenciaDia(ev, referenciaPorDia);
    if (cmp.tipo === 'igual') {
      iguais += 1;
      continue;
    }
    if (cmp.tipo === 'dia_sem_referencia') {
      semReferencia += 1;
      if (opts.incluirSemReferencia) {
        divergencias.dia_sem_referencia.push({
          usuarioPasta: ev.usuarioPasta,
          dataEvento: ev.dataEvento,
          linhaLegado: ev.linhaLegado,
          estruturado: {
            hora: ev.horaEvento,
            descricao: ev.descricao,
            status: ev.statusCurto,
          },
          tipo: cmp.tipo,
        });
      }
      continue;
    }

    const item = {
      usuarioPasta: ev.usuarioPasta,
      dataEvento: ev.dataEvento,
      linhaLegado: ev.linhaLegado,
      estruturado: {
        hora: ev.horaEvento,
        descricao: ev.descricao,
        status: ev.statusCurto,
        ficheiros: ev.paths,
      },
      tipo: cmp.tipo,
    };

    if (cmp.tipo === 'diferente') {
      const refLista = referenciaPorDia.get(`${ev.usuarioPasta}|${ev.dataEvento}`) ?? [];
      item.referenciaDia = refLista.map((r) => ({
        hora: r.horaEvento,
        descricao: String(r.descricao ?? '').slice(0, 500),
        status: r.statusCurto,
        linhaCsv: r.linhaLegado,
      }));
      divergencias.diferente.push(item);
    } else if (cmp.tipo === 'ambiguo') {
      const refLista = referenciaPorDia.get(`${ev.usuarioPasta}|${ev.dataEvento}`) ?? [];
      item.candidatosReferencia = refLista.length;
      item.referenciaDia = refLista.slice(0, 5).map((r) => ({
        hora: r.horaEvento,
        descricao: String(r.descricao ?? '').slice(0, 200),
        status: r.statusCurto,
        linhaCsv: r.linhaLegado,
      }));
      divergencias.ambiguo.push(item);
    }
  }

  const comparadosComRef = total - semReferencia;
  const rel = {
    geradoEm: new Date().toISOString(),
    baseAgenda: opts.baseAgenda,
    ficheirosDiaLegado: ficheirosDia,
    totalEstruturados: total,
    iguais,
    resumo: {
      diferente: divergencias.diferente.length,
      ambiguo: divergencias.ambiguo.length,
      dia_sem_referencia: semReferencia,
    },
    percentualIgualComReferencia:
      comparadosComRef > 0 ? Number(((100 * iguais) / comparadosComRef).toFixed(2)) : null,
    divergencias,
  };

  const abs = path.resolve(opts.relatorio);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(rel, null, 2), 'utf8');

  const ms = Date.now() - t0;
  console.log(`Total estruturados: ${total}`);
  console.log(`Iguais: ${iguais}`);
  console.log(`Diferente: ${divergencias.diferente.length}`);
  console.log(`Ambíguo: ${divergencias.ambiguo.length}`);
  console.log(`Dia sem dd.mm.yyyy.txt: ${rel.resumo.dia_sem_referencia}`);
  if (comparadosComRef > 0) {
    console.log(`% igual (com referência): ${rel.percentualIgualComReferencia}%`);
  }
  console.log(`\nRelatório: ${abs} (${ms} ms)`);

  if (divergencias.diferente.length) {
    console.log('\n--- DIFERENTE ---');
    for (const d of divergencias.diferente.slice(0, 20)) {
      console.log(`${d.usuarioPasta} ${d.dataEvento} L${d.linhaLegado}`);
      console.log('  estruturado:', JSON.stringify(d.estruturado));
      console.log('  referência:', JSON.stringify(d.referenciaDia?.slice(0, 3)));
    }
  }
  if (divergencias.ambiguo.length) {
    console.log(`\n--- AMBÍGUO (primeiros 10 de ${divergencias.ambiguo.length}) ---`);
    for (const d of divergencias.ambiguo.slice(0, 10)) {
      console.log(`${d.usuarioPasta} ${d.dataEvento} L${d.linhaLegado}: ${d.estruturado.descricao?.slice(0, 80) || '(vazio)'}`);
    }
  }
}

main();
