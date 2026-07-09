#!/usr/bin/env node
/**
 * Lê manifesto de candidatos (inventário) e extrai dados de cada documento.
 *
 * Uso:
 *   node scripts/extrair-contrato-honorarios-do-manifesto.mjs
 *   node scripts/extrair-contrato-honorarios-do-manifesto.mjs --manifest tmp/.../v4-candidatos.json
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { extrairTextoPdfDeBuffer } from './lib/extrair-texto-pdf-node.mjs';
import {
  extrairContratoHonorariosHeuristico,
  extrairClausula3,
} from './lib/contratoHonorariosExtracaoHeuristica.mjs';

const MANIFESTO_PADRAO =
  'tmp/contratos-honorarios-inventario/inventario-728-800-999-v4-candidatos.json';

function parseArgs(argv) {
  const out = { manifesto: MANIFESTO_PADRAO, saida: null, verbose: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--manifest') out.manifesto = argv[++i];
    else if (a === '--saida') out.saida = argv[++i];
    else if (a === '--verbose') out.verbose = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function extrairDadosTelecom(texto) {
  const nome = texto.match(/Nome:\s*([^\n]+)/i)?.[1]?.trim() ?? null;
  const cpf = texto.match(/CPF:\s*([\d./-]+)/i)?.[1]?.trim() ?? null;
  const contratoN = texto.match(/Contrato\s+N\.?\s*(\d+)/i)?.[1]?.trim() ?? null;
  const plano = texto.match(/Plano:\s*([^\n]+)/i)?.[1]?.trim() ?? null;
  const valorMensal = texto.match(/Valor\s+Mensal:\s*([\d.,]+)/i)?.[1]?.replace(',', '.') ?? null;
  const vencimento = texto.match(/Vencimento:\s*(\d{1,2})/i)?.[1] ?? null;
  const prazo = texto.match(/Prazo\s+Contratual:\s*(\d+)/i)?.[1] ?? null;
  return {
    tipoDocumento: 'CONTRATO_TELECOM_SE77E',
    nomeAssinante: nome,
    cpfAssinante: cpf,
    numeroContratoTelecom: contratoN,
    plano,
    valorMensal: valorMensal != null ? Number(valorMensal) : null,
    diaVencimento: vencimento != null ? Number(vencimento) : null,
    prazoContratualMeses: prazo != null ? Number(prazo) : null,
  };
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

async function processarItem(item, idx, total) {
  const base = {
    ...item,
    status: 'OK',
    numPages: 0,
    classificacao: null,
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

  const ext = path.extname(item.caminhoAbsoluto).toLowerCase();
  if (ext !== '.pdf') {
    base.status = 'FORMATO_NAO_SUPORTADO';
    base.erro = `Extensão ${ext} não suportada na extração`;
    return base;
  }

  try {
    const { texto, numPages } = await extrairTextoPdfDeBuffer(item.caminhoAbsoluto);
    base.numPages = numPages;

    if (item.motivoSelecao?.startsWith('HONOR_PROCESSUAL')) {
      base.classificacao = 'HONOR_PROCESSUAL';
      base.scoreConfianca = 0;
      base.alertas = ['Peça processual com honorários — não é contrato de prestação.'];
      base.dados = { tipoDocumento: 'HONOR_PROCESSUAL' };
      return base;
    }

    const resultado = extrairContratoHonorariosHeuristico(texto);
    base.classificacao = classificarConteudo(texto, resultado);

    if (base.classificacao === 'CONTRATO_TELECOM_SE77E') {
      base.scoreConfianca = 0;
      base.alertas = ['Contrato telecom SE77E (não honorários advocatícios Villa Real).'];
      base.dados = extrairDadosTelecom(texto);
      base.clausulaExtraida = null;
    } else {
      base.scoreConfianca = resultado.scoreConfianca;
      base.alertas = resultado.alertas;
      base.dados = resultado.dados;
      base.clausulaExtraida = resultado.clausulaExtraida || null;
    }
  } catch (err) {
    base.status = 'ERRO';
    base.erro = err?.message || String(err);
    base.classificacao = 'ERRO_LEITURA';
  }

  if ((idx + 1) % 20 === 0 || idx + 1 === total) {
    console.error(`  ... ${idx + 1}/${total}`);
  }
  return base;
}

function gerarResumo(itens) {
  const porClass = {};
  for (const it of itens) {
    const k = it.classificacao || it.status;
    porClass[k] = (porClass[k] || 0) + 1;
  }
  const honor = itens.filter((i) => i.classificacao === 'HONORARIOS_VILLAREAL');
  const telecom = itens.filter((i) => i.classificacao === 'CONTRATO_TELECOM_SE77E');
  return {
    total: itens.length,
    ok: itens.filter((i) => i.status === 'OK').length,
    erros: itens.filter((i) => i.status !== 'OK').length,
    porClassificacao: porClass,
    honorariosVillaReal: honor.length,
    telecomSe77e: telecom.length,
    scoreMedioHonorarios:
      honor.length > 0
        ? Math.round(honor.reduce((s, i) => s + i.scoreConfianca, 0) / honor.length)
        : null,
  };
}

function gerarCsv(itens) {
  const header = [
    'numeroInterno',
    'classificacao',
    'status',
    'scoreConfianca',
    'motivoSelecao',
    'tipoRemuneracao',
    'percentualProveito',
    'valorFixo',
    'quantidadeParcelas',
    'dataContrato',
    'numeroCnjExtraido',
    'nomeAssinante',
    'valorMensal',
    'plano',
    'nomeArquivo',
    'caminhoAbsoluto',
    'alertas',
  ];
  const rows = [header.join(';')];
  for (const it of itens) {
    const d = it.dados || {};
    rows.push(
      [
        it.numeroInterno,
        it.classificacao ?? '',
        it.status,
        it.scoreConfianca ?? '',
        it.motivoSelecao ?? '',
        d.tipoRemuneracao ?? d.tipoDocumento ?? '',
        d.percentualProveito ?? '',
        d.valorFixo ?? '',
        d.quantidadeParcelas ?? '',
        d.dataContrato ?? '',
        d.numeroCnjExtraido ?? '',
        d.nomeAssinante ?? d.partesExtraidas ?? '',
        d.valorMensal ?? '',
        d.plano ?? '',
        it.nomeArquivo ?? '',
        it.caminhoAbsoluto ?? '',
        (it.alertas ?? []).join(' | ').replace(/;/g, ','),
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
    console.log('Uso: node scripts/extrair-contrato-honorarios-do-manifesto.mjs [--manifest path]');
    process.exit(0);
  }

  const manifestoPath = path.resolve(opts.manifesto);
  const candidatos = JSON.parse(fs.readFileSync(manifestoPath, 'utf8'));
  console.error(`Manifesto: ${manifestoPath} (${candidatos.length} documentos)`);

  const itens = [];
  for (let i = 0; i < candidatos.length; i += 1) {
    itens.push(await processarItem(candidatos[i], i, candidatos.length));
  }

  const payload = {
    resumo: gerarResumo(itens),
    manifesto: manifestoPath,
    geradoEm: new Date().toISOString(),
    itens,
  };

  const outBase = opts.saida
    ? path.resolve(opts.saida).replace(/\.json$/i, '')
    : path.resolve('tmp/contratos-honorarios-inventario/extracao-728-800-999-v4');

  fs.mkdirSync(path.dirname(outBase), { recursive: true });
  fs.writeFileSync(`${outBase}.json`, JSON.stringify(payload, null, 2), 'utf8');
  fs.writeFileSync(`${outBase}.csv`, gerarCsv(itens), 'utf8');

  console.error('\n=== Resumo extração ===');
  console.error(JSON.stringify(payload.resumo, null, 2));
  console.error(`\nJSON: ${outBase}.json`);
  console.error(`CSV:  ${outBase}.csv`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
