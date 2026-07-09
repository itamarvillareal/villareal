#!/usr/bin/env node
/**
 * Varre todos os clientes (código N) no Drive e lista candidatos a contrato de honorários.
 * Percorre a pasta inteira de cada cliente (raiz + Proc.* + subpastas).
 *
 * Uso:
 *   node scripts/inventariar-contratos-honorarios-carteira.mjs --cliente-inicio 1 --cliente-fim 999
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  classificarNomeArquivo,
  normalizarNomeParaPadrao,
  EXTENSOES_INVENTARIO,
} from './lib/contratoHonorariosPadroesArquivo.mjs';

const DRIVE_BASE =
  '/Users/itamar/Library/CloudStorage/GoogleDrive-itamar.villareal@villarealadvocacia.adv.br/Drives compartilhados/Villa Real Documentos/Sistema VilaReal/clientes/01 - Ativos';

function parseArgs(argv) {
  const out = {
    clienteInicio: 1,
    clienteFim: 999,
    saida: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--cliente-inicio') out.clienteInicio = Number(argv[++i]);
    else if (a === '--cliente-fim') out.clienteFim = Number(argv[++i]);
    else if (a === '--saida') out.saida = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function carregarIndiceClientes() {
  const indice = new Map();
  const entries = fs.readdirSync(DRIVE_BASE, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const m = ent.name.match(/^(\d{8})\s+-/);
    if (!m) continue;
    const cod8 = m[1];
    const codigo = Number(cod8);
    if (!Number.isFinite(codigo)) continue;
    indice.set(codigo, {
      cod8,
      codigo,
      nomePasta: ent.name,
      caminho: path.join(DRIVE_BASE, ent.name),
    });
  }
  return indice;
}

function extrairNumeroProc(caminhoAbsoluto) {
  const m = caminhoAbsoluto.match(/[/\\]Proc\.\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

function varrerCliente(pastaCliente) {
  const arquivos = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (!EXTENSOES_INVENTARIO.includes(ext)) continue;
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      arquivos.push({
        caminhoAbsoluto: full,
        nomeArquivo: ent.name,
        extensao: ext,
        tamanhoBytes: stat.size,
        pastaRelativa: path.relative(pastaCliente, path.dirname(full)) || '(raiz cliente)',
        profundidade: path.relative(pastaCliente, full).split(path.sep).length - 1,
      });
    }
  }
  walk(pastaCliente);
  return arquivos;
}

function gerarCsvCandidatos(candidatos) {
  const header = [
    'codigoCliente',
    'numeroInterno',
    'motivoSelecao',
    'nomeArquivo',
    'extensao',
    'pastaRelativa',
    'tamanhoBytes',
    'padraoNormalizado',
    'caminhoAbsoluto',
  ];
  const rows = [header.join(';')];
  for (const d of candidatos) {
    rows.push(
      [
        d.codigoCliente,
        d.numeroInterno ?? '',
        d.motivoSelecao,
        d.nomeArquivo,
        d.extensao,
        d.pastaRelativa,
        d.tamanhoBytes,
        d.padraoNormalizado,
        d.caminhoAbsoluto,
      ]
        .map((v) => String(v ?? '').replace(/;/g, ','))
        .join(';'),
    );
  }
  return rows.join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Uso:
  node scripts/inventariar-contratos-honorarios-carteira.mjs --cliente-inicio 1 --cliente-fim 999`);
    process.exit(0);
  }

  const indice = carregarIndiceClientes();
  const candidatos = [];
  const porCliente = [];
  let clientesSemPasta = 0;
  let clientesVarridos = 0;
  let totalArquivos = 0;

  console.error(`Carteira: clientes ${opts.clienteInicio}..${opts.clienteFim} (${indice.size} pastas no Drive)`);

  for (let cod = opts.clienteInicio; cod <= opts.clienteFim; cod += 1) {
    const info = indice.get(cod);
    if (!info) {
      clientesSemPasta += 1;
      continue;
    }

    const arquivos = varrerCliente(info.caminho);
    totalArquivos += arquivos.length;
    clientesVarridos += 1;

    let candCliente = 0;
    for (const arq of arquivos) {
      const cls = classificarNomeArquivo(arq.nomeArquivo, {
        caminhoAbsoluto: arq.caminhoAbsoluto,
        pastaCliente: info.caminho,
      });
      const selecionado =
        cls.candidato != null &&
        cls.prioridadeLeitura != null &&
        cls.prioridadeLeitura <= 4 &&
        arq.tamanhoBytes > 0;
      if (!selecionado) continue;

      candCliente += 1;
      candidatos.push({
        codigoCliente: info.cod8,
        codigoClienteNum: cod,
        nomeCliente: info.nomePasta,
        numeroInterno: extrairNumeroProc(arq.caminhoAbsoluto),
        prioridadeLeitura: cls.prioridadeLeitura,
        motivoSelecao: cls.motivo,
        padraoCandidato: cls.candidato.id,
        padraoNormalizado: normalizarNomeParaPadrao(arq.nomeArquivo),
        ...arq,
      });
    }

    if (candCliente > 0) {
      porCliente.push({
        codigo: cod,
        cod8: info.cod8,
        nome: info.nomePasta,
        totalArquivos: arquivos.length,
        candidatos: candCliente,
      });
    }

    if (cod % 50 === 0) {
      console.error(
        `  ... cliente ${cod} | varridos ${clientesVarridos} | candidatos ${candidatos.length} | arquivos ${totalArquivos}`,
      );
    }
  }

  porCliente.sort((a, b) => b.candidatos - a.candidatos);

  const payload = {
    resumo: {
      clienteInicio: opts.clienteInicio,
      clienteFim: opts.clienteFim,
      geradoEm: new Date().toISOString(),
      clientesNoDrive: indice.size,
      clientesSemPasta,
      clientesVarridos,
      clientesComCandidatos: porCliente.length,
      totalArquivosVarridos: totalArquivos,
      candidatosLeitura: candidatos.length,
      candidatosPdf: candidatos.filter((c) => c.extensao === '.pdf').length,
      candidatosDocx: candidatos.filter((c) => c.extensao === '.docx').length,
      candidatosDoc: candidatos.filter((c) => c.extensao === '.doc').length,
      topClientes: porCliente.slice(0, 25),
    },
    candidatosLeitura: candidatos,
  };

  const outDir = path.resolve('tmp/contratos-honorarios-inventario');
  fs.mkdirSync(outDir, { recursive: true });
  const basePath = opts.saida
    ? path.resolve(opts.saida).replace(/\.json$/i, '')
    : path.join(outDir, `inventario-carteira-${opts.clienteInicio}-${opts.clienteFim}`);

  fs.writeFileSync(`${basePath}.json`, JSON.stringify(payload, null, 2), 'utf8');
  fs.writeFileSync(`${basePath}-candidatos.json`, JSON.stringify(candidatos, null, 2), 'utf8');
  fs.writeFileSync(`${basePath}-candidatos.csv`, gerarCsvCandidatos(candidatos), 'utf8');
  fs.writeFileSync(
    `${basePath}-por-cliente.json`,
    JSON.stringify({ porCliente }, null, 2),
    'utf8',
  );

  console.error('\n=== Resumo carteira ===');
  console.error(JSON.stringify(payload.resumo, null, 2));
  console.error(`\nArquivos:`);
  console.error(`  ${basePath}.json`);
  console.error(`  ${basePath}-candidatos.json  (${candidatos.length})`);
  console.error(`  ${basePath}-candidatos.csv`);
  console.error(`  ${basePath}-por-cliente.json`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
