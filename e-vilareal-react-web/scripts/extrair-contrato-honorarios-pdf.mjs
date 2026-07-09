#!/usr/bin/env node
/**
 * Extrai dados de contrato de honorários Villa Real sem IA (regex + modelo fixo).
 *
 * Uso:
 *   node scripts/extrair-contrato-honorarios-pdf.mjs <arquivo.pdf>
 *   node scripts/extrair-contrato-honorarios-pdf.mjs --cliente 73 --proc 1
 *
 * Exemplo cliente 73 / proc 1:
 *   node scripts/extrair-contrato-honorarios-pdf.mjs --cliente 73 --proc 1
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { extrairTextoPdfDeBuffer } from './lib/extrair-texto-pdf-node.mjs';
import { extrairContratoHonorariosHeuristico } from './lib/contratoHonorariosExtracaoHeuristica.mjs';

const PDF_CLAUDIOMAR =
  '/Users/itamar/Library/CloudStorage/GoogleDrive-itamar.villareal@villarealadvocacia.adv.br/Drives compartilhados/Villa Real Documentos/Sistema VilaReal/clientes/01 - Ativos/00000073 - CLAUDIOMAR TEIXEIRA DA SILVA JUNIOR/Proc. 01/CAIXA ECONOMICA FEDERAL/Contrato de Honorários Advocatícios - Claudiomar.pdf';

function parseArgs(argv) {
  const out = { pdf: null, cliente: null, proc: null, json: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--cliente') out.cliente = argv[++i];
    else if (a === '--proc') out.proc = argv[++i];
    else if (a === '--pretty') out.json = 'pretty';
    else if (a === '--help' || a === '-h') out.help = true;
    else if (!a.startsWith('-')) out.pdf = a;
  }
  return out;
}

function resolverPdf(opts) {
  if (opts.pdf) return path.resolve(opts.pdf);
  if (opts.cliente === '73' && (opts.proc === '1' || opts.proc === '01')) {
    return PDF_CLAUDIOMAR;
  }
  throw new Error('Informe o caminho do PDF ou --cliente 73 --proc 1');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Uso:
  node scripts/extrair-contrato-honorarios-pdf.mjs <arquivo.pdf>
  node scripts/extrair-contrato-honorarios-pdf.mjs --cliente 73 --proc 1`);
    process.exit(0);
  }

  const pdfPath = resolverPdf(opts);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF não encontrado: ${pdfPath}`);
  }

  const { texto, numPages } = await extrairTextoPdfDeBuffer(pdfPath);
  const resultado = extrairContratoHonorariosHeuristico(texto);

  const payload = {
    arquivo: pdfPath,
    numPages,
    scoreConfianca: resultado.scoreConfianca,
    alertas: resultado.alertas,
    clausulaExtraida: resultado.clausulaExtraida,
    dados: resultado.dados,
  };

  if (opts.json === 'pretty') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(JSON.stringify(payload));
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
