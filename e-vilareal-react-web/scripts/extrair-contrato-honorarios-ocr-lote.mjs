#!/usr/bin/env node
/**
 * Reextrai contratos de honorários com OCR (ocrmypdf) nos PDFs sem texto.
 *
 * Uso:
 *   node scripts/extrair-contrato-honorarios-ocr-lote.mjs
 *   node scripts/extrair-contrato-honorarios-ocr-lote.mjs --limite 20
 *   node scripts/extrair-contrato-honorarios-ocr-lote.mjs --retomar
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { extrairTextoPdfComOcr } from './lib/ocr-pdf-node.mjs';
import {
  extrairContratoHonorariosHeuristico,
  extrairClausula3,
} from './lib/contratoHonorariosExtracaoHeuristica.mjs';

const ENTRADA_PADRAO =
  'tmp/contratos-honorarios-inventario/extracao-carteira-1-999-honor-pdf.json';
const SAIDA_PADRAO =
  'tmp/contratos-honorarios-inventario/extracao-carteira-1-999-ocr';
const CHECKPOINT_PADRAO =
  'tmp/contratos-honorarios-inventario/extracao-carteira-1-999-ocr-checkpoint.json';

function parseArgs(argv) {
  const out = {
    entrada: ENTRADA_PADRAO,
    saida: SAIDA_PADRAO,
    checkpoint: CHECKPOINT_PADRAO,
    limite: null,
    retomar: false,
    apenasSemTexto: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--entrada') out.entrada = argv[++i];
    else if (a === '--saida') out.saida = argv[++i];
    else if (a === '--checkpoint') out.checkpoint = argv[++i];
    else if (a.startsWith('--limite=')) out.limite = Number(a.slice('--limite='.length));
    else if (a === '--limite') out.limite = Number(argv[++i]);
    else if (a === '--retomar') out.retomar = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function classificarConteudo(texto, resultado) {
  if (!texto || texto.length < 80) return 'PDF_SEM_TEXTO_UTIL';
  const honorTitulo = /CONTRATO\s+DE\s+HONOR[ÁA]RIOS/i.test(texto);
  const clausula3 = Boolean(extrairClausula3(texto));
  if (honorTitulo && clausula3 && resultado.dados?.tipoRemuneracao) return 'HONORARIOS_VILLAREAL';
  if (clausula3 && resultado.dados?.tipoRemuneracao && resultado.scoreConfianca >= 70) {
    return 'HONORARIOS_VILLAREAL';
  }
  if (honorTitulo || clausula3) return 'HONORARIOS_PARCIAL';
  if (/SE77E\s+TELECOM|Termo\s+de\s+Ades[aã]o|Comunica[cç][aã]o\s+Multim/i.test(texto)) {
    return 'CONTRATO_TELECOM_SE77E';
  }
  if (/honor[aá]rios|honorarios/i.test(texto) && /certid|manifesta/i.test(texto)) {
    return 'HONOR_PROCESSUAL';
  }
  return 'OUTRO_DOCUMENTO';
}

function gerarResumo(itens) {
  const porClass = {};
  for (const it of itens) {
    const k = it.classificacao || it.status;
    porClass[k] = (porClass[k] || 0) + 1;
  }
  const honor = itens.filter((i) => i.classificacao === 'HONORARIOS_VILLAREAL');
  return {
    total: itens.length,
    ok: itens.filter((i) => i.status === 'OK').length,
    ocrAplicado: itens.filter((i) => i.ocrAplicado).length,
    ocrErros: itens.filter((i) => i.erroOcr).length,
    porClassificacao: porClass,
    honorariosVillaReal: honor.length,
    scoreMedioHonorarios:
      honor.length > 0
        ? Math.round(honor.reduce((s, i) => s + i.scoreConfianca, 0) / honor.length)
        : null,
  };
}

async function processarItem(item) {
  const base = {
    ...item,
    status: 'OK',
    ocrAplicado: false,
    erroOcr: null,
    classificacao: item.classificacao,
    scoreConfianca: 0,
    alertas: [],
    dados: null,
    clausulaExtraida: null,
    erro: null,
  };

  if (!fs.existsSync(item.caminhoAbsoluto)) {
    base.status = 'ARQUIVO_INEXISTENTE';
    base.erro = 'Arquivo não encontrado';
    return base;
  }

  try {
    const ocr = await extrairTextoPdfComOcr(item.caminhoAbsoluto);
    base.ocrAplicado = ocr.ocrAplicado;
    base.numPages = ocr.numPages;
    if (ocr.erro) {
      base.erroOcr = ocr.erro;
      base.alertas.push(ocr.erro);
    }
    if (ocr.ocrAplicado) base.alertas.push('PDF escaneado — OCR aplicado (ocrmypdf).');

    const resultado = extrairContratoHonorariosHeuristico(ocr.texto);
    base.classificacao = classificarConteudo(ocr.texto, resultado);
    base.scoreConfianca = resultado.scoreConfianca;
    base.alertas.push(...resultado.alertas);
    base.dados = resultado.dados;
    base.clausulaExtraida = resultado.clausulaExtraida || null;
  } catch (err) {
    base.status = 'ERRO';
    base.erro = err?.message || String(err);
    base.classificacao = 'ERRO_LEITURA';
  }

  return base;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.error(`Uso:
  node scripts/extrair-contrato-honorarios-ocr-lote.mjs [--limite N] [--retomar]`);
    process.exit(0);
  }

  const entradaPath = path.resolve(opts.entrada);
  const payload = JSON.parse(fs.readFileSync(entradaPath, 'utf8'));
  const todos = payload.itens ?? payload;
  const candidatos = todos.filter((x) => x.classificacao === 'PDF_SEM_TEXTO_UTIL');

  let processados = [];
  let offset = 0;
  const checkpointPath = path.resolve(opts.checkpoint);
  if (opts.retomar && fs.existsSync(checkpointPath)) {
    const ck = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
    processados = ck.itens ?? [];
    offset = ck.offset ?? processados.length;
    console.error(`Retomando do item ${offset} (${processados.length} já processados)`);
  }

  const fila = candidatos.slice(offset);
  const alvo = opts.limite != null ? fila.slice(0, opts.limite) : fila;
  console.error(`OCR lote: ${alvo.length} PDFs (total sem texto: ${candidatos.length})`);

  const novos = [];
  for (let i = 0; i < alvo.length; i += 1) {
    const item = alvo[i];
    const idx = offset + i + 1;
    const t0 = Date.now();
    const res = await processarItem(item);
    novos.push(res);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    if (idx % 5 === 0 || idx === offset + alvo.length) {
      console.error(
        `  ... ${idx}/${candidatos.length} ${res.classificacao} ocr=${res.ocrAplicado} ${dt}s ${item.nomeArquivo?.slice(0, 40)}`,
      );
    }
    if (idx % 10 === 0) {
      const parcial = [...processados, ...novos];
      fs.writeFileSync(
        checkpointPath,
        JSON.stringify({ offset: idx, itens: parcial, atualizadoEm: new Date().toISOString() }, null, 2),
        'utf8',
      );
    }
  }

  const itens = [...processados, ...novos];
  const outBase = path.resolve(opts.saida).replace(/\.json$/i, '');
  fs.mkdirSync(path.dirname(outBase), { recursive: true });

  const resultado = {
    resumo: gerarResumo(itens),
    entrada: entradaPath,
    geradoEm: new Date().toISOString(),
    itens,
  };

  fs.writeFileSync(`${outBase}.json`, JSON.stringify(resultado, null, 2), 'utf8');
  fs.writeFileSync(
    checkpointPath,
    JSON.stringify({ offset: offset + alvo.length, itens, atualizadoEm: new Date().toISOString() }, null, 2),
    'utf8',
  );

  console.error('\n=== Resumo OCR ===');
  console.error(JSON.stringify(resultado.resumo, null, 2));
  console.error(`\nJSON: ${outBase}.json`);
  console.error(`Checkpoint: ${checkpointPath}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
