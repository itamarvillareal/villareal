#!/usr/bin/env node
/**
 * Lista pares (código cliente, nº interno) de processos consultados num dia — txt HC.
 *
 * Comportamento alinhado ao popup Excel «Processos Consultados em DD/MM/AAAA»:
 * inclui processos cujo único histórico do dia seja título automático (JUNTAR PETIÇÃO…).
 *
 * Uso:
 *   node scripts/listar-processos-consultados-txt.mjs
 *   node scripts/listar-processos-consultados-txt.mjs --data=05/06/2026
 *   node scripts/listar-processos-consultados-txt.mjs --data=2026-06-05 --json
 *   node scripts/listar-processos-consultados-txt.mjs --data=05/06/2026 --excluir-titulos-automaticos
 *
 * Opções:
 *   --data=DD/MM/AAAA|YYYY-MM-DD   Dia alvo (defeito: hoje, fuso local)
 *   --base=PATH                    Raiz «Banco de Dados»
 *   --json                         Saída JSON (array de pares + metadados)
 *   --compacto                     Só `cod,proc` por linha
 *   --excluir-titulos-automaticos  Modo «Consultas Realizadas» (exclui JUNTAR PETIÇÃO…)
 */

import process from 'node:process';

import { DEFAULT_BASE_HISTORICO_LOCAL } from './lib/historico-local-txt-paths.mjs';
import {
  dataConsultadosHoje,
  formatarParConsultado,
  listarProcessosConsultadosTxt,
  parseDataConsultadosArg,
} from './lib/processos-consultados-txt.mjs';

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE_HISTORICO_LOCAL,
    data: null,
    json: false,
    compacto: false,
    excluirTitulosAutomaticos: false,
  };
  for (const a of argv) {
    if (a.startsWith('--base=')) out.base = a.slice(7);
    else if (a.startsWith('--data=')) out.data = a.slice(7);
    else if (a === '--json') out.json = true;
    else if (a === '--compacto') out.compacto = true;
    else if (a === '--excluir-titulos-automaticos') out.excluirTitulosAutomaticos = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Uso: node scripts/listar-processos-consultados-txt.mjs [--data=DD/MM/AAAA] [--json] [--compacto]`);
      process.exit(0);
    }
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dia = opts.data ? parseDataConsultadosArg(opts.data) : dataConsultadosHoje();
  if (!dia) {
    console.error(`Data inválida: ${opts.data ?? ''} (use DD/MM/AAAA ou YYYY-MM-DD)`);
    process.exit(2);
  }

  const { candidatos, itens } = listarProcessosConsultadosTxt({
    base: opts.base,
    dataIso: dia.iso,
    ano: dia.ano,
    mes: dia.mes,
    excluirTitulosAutomaticos: opts.excluirTitulosAutomaticos,
  });

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          data: dia.br,
          dataIso: dia.iso,
          base: opts.base,
          modo: opts.excluirTitulosAutomaticos ? 'consultas-realizadas' : 'processos-consultados',
          candidatosMes: candidatos,
          total: itens.length,
          itens,
        },
        null,
        2,
      ),
    );
    return;
  }

  const modo = opts.excluirTitulosAutomaticos ? 'Consultas Realizadas' : 'Processos Consultados';
  console.error(`[txt] ${modo} em ${dia.br} | base=${opts.base}`);
  console.error(`[txt] candidatos no mês ${String(dia.mes).padStart(2, '0')}/${dia.ano}: ${candidatos} → ${itens.length} par(es)\n`);

  if (opts.compacto) {
    for (const row of itens) console.log(formatarParConsultado(row));
    return;
  }

  console.log(`${modo} em ${dia.br} (${itens.length} pares)\n`);
  itens.forEach((row, i) => {
    const auto = row.tituloAutomatico ? ' [auto]' : '';
    console.log(
      `${String(i + 1).padStart(3, '0')} | cod=${row.codigoCliente8} | proc=${String(row.proc).padStart(2, '0')}${auto} | ${String(row.info).slice(0, 100)}`,
    );
  });
}

main();
