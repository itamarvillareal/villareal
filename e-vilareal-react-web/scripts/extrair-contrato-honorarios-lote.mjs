#!/usr/bin/env node
/**
 * Varre processos de um cliente no Drive, extrai dados de contratos (heurística, sem IA).
 *
 * Uso:
 *   node scripts/extrair-contrato-honorarios-lote.mjs --cliente 728 --proc-inicio 800 --proc-fim 999
 *   node scripts/extrair-contrato-honorarios-lote.mjs --cliente 728 --proc-inicio 800 --proc-fim 999 --saida tmp/lote.json
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { extrairTextoPdfDeBuffer } from './lib/extrair-texto-pdf-node.mjs';
import {
  extrairContratoHonorariosHeuristico,
  extrairClausula3,
} from './lib/contratoHonorariosExtracaoHeuristica.mjs';
import {
  classificarNomeArquivo,
  EXTENSOES_INVENTARIO,
} from './lib/contratoHonorariosPadroesArquivo.mjs';

const DRIVE_BASE =
  '/Users/itamar/Library/CloudStorage/GoogleDrive-itamar.villareal@villarealadvocacia.adv.br/Drives compartilhados/Villa Real Documentos/Sistema VilaReal/clientes/01 - Ativos';

const CLIENTES_DRIVE = {
  728: '00000728 - SE77E TELECOM EIRELI ME',
  73: '00000073 - CLAUDIOMAR TEIXEIRA DA SILVA JUNIOR',
};

function parseArgs(argv) {
  const out = {
    cliente: '728',
    procInicio: 800,
    procFim: 999,
    saida: null,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--cliente') out.cliente = argv[++i];
    else if (a === '--proc-inicio') out.procInicio = Number(argv[++i]);
    else if (a === '--proc-fim') out.procFim = Number(argv[++i]);
    else if (a === '--saida') out.saida = argv[++i];
    else if (a === '--verbose') out.verbose = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function resolverPastaCliente(codigo) {
  const key = String(codigo).replace(/^0+/, '') || codigo;
  if (CLIENTES_DRIVE[key]) {
    return path.join(DRIVE_BASE, CLIENTES_DRIVE[key]);
  }
  const cod8 = String(codigo).padStart(8, '0');
  const entries = fs.readdirSync(DRIVE_BASE, { withFileTypes: true });
  const hit = entries.find((e) => e.isDirectory() && e.name.startsWith(`${cod8} -`));
  if (!hit) throw new Error(`Cliente ${codigo} não encontrado em ${DRIVE_BASE}`);
  return path.join(DRIVE_BASE, hit.name);
}

/** Varre todas as pastas/subpastas; seleciona por padrões de nome (prioridade <= 4). */
function listarArquivosParaLeitura(procDir) {
  const found = [];
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
      const stat = fs.statSync(full);
      if (stat.size === 0) continue;
      const cls = classificarNomeArquivo(ent.name, { caminhoAbsoluto: full });
      if (cls.prioridadeLeitura == null || cls.prioridadeLeitura > 4) continue;
      found.push({
        caminho: full,
        prioridade: cls.prioridadeLeitura,
        peso: cls.candidato?.peso ?? (cls.honorProcessual ? 40 : 10),
        motivo: cls.motivo,
      });
    }
  }
  walk(procDir);
  found.sort((a, b) => a.prioridade - b.prioridade || b.peso - a.peso);
  return found;
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

function classificarDocumento(texto, resultado) {
  if (!texto || texto.length < 80) return 'PDF_SEM_TEXTO_UTIL';
  const telecom = /SE77E\s+TELECOM|Termo\s+de\s+Ades[aã]o|Comunica[cç][aã]o\s+Multim/i.test(texto);
  if (telecom) return 'CONTRATO_TELECOM_SE77E';
  const honorTitulo = /CONTRATO\s+DE\s+HONOR[ÁA]RIOS/i.test(texto);
  const clausula3 = Boolean(extrairClausula3(texto));
  if (honorTitulo && clausula3 && resultado.dados?.tipoRemuneracao) {
    return 'HONORARIOS_VILLAREAL';
  }
  if (clausula3 && resultado.dados?.tipoRemuneracao && resultado.scoreConfianca >= 70) {
    return 'HONORARIOS_VILLAREAL';
  }
  if (honorTitulo || clausula3) return 'HONORARIOS_PARCIAL';
  return 'OUTRO_DOCUMENTO';
}

function resolverProcDir(pastaCliente, n) {
  const nomes = [`Proc. ${n}`, `Proc. ${String(n).padStart(2, '0')}`];
  const vistos = new Set();
  for (const nome of nomes) {
    if (vistos.has(nome)) continue;
    vistos.add(nome);
    const full = path.join(pastaCliente, nome);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

async function processarProc(pastaCliente, numeroInterno) {
  const procDir = resolverProcDir(pastaCliente, numeroInterno);
  const base = {
    codigoCliente: null,
    numeroInterno,
    parteOposta: null,
    status: 'SEM_PASTA_PROC',
    pdfsEncontrados: [],
    arquivoSelecionado: null,
    tamanhoBytes: 0,
    numPages: 0,
    classificacao: null,
    scoreConfianca: 0,
    alertas: [],
    dados: null,
    clausulaExtraida: null,
    erro: null,
  };

  if (!procDir) {
    return base;
  }

  const arquivos = listarArquivosParaLeitura(procDir);
  base.pdfsEncontrados = arquivos.map((a) => path.relative(pastaCliente, a.caminho));
  base.motivosEncontrados = arquivos.map((a) => a.motivo);

  if (arquivos.length === 0) {
    base.status = 'SEM_CONTRATO_PDF';
    return base;
  }

  const arquivo = arquivos[0].caminho;
  const stat = fs.statSync(arquivo);
  base.arquivoSelecionado = arquivo;
  base.tamanhoBytes = stat.size;
  base.parteOposta = path.basename(path.dirname(arquivo));

  if (stat.size === 0) {
    base.status = 'ARQUIVO_VAZIO';
    base.classificacao = 'ARQUIVO_VAZIO';
    return base;
  }

  try {
    const { texto, numPages } = await extrairTextoPdfDeBuffer(arquivo);
    base.numPages = numPages;
    const resultado = extrairContratoHonorariosHeuristico(texto);
    base.classificacao = classificarDocumento(texto, resultado);
    if (base.classificacao === 'CONTRATO_TELECOM_SE77E') {
      base.scoreConfianca = 0;
      base.alertas = ['Documento é contrato de telecom (SE77E), não honorários advocatícios Villa Real.'];
      base.dados = extrairDadosTelecom(texto);
      base.clausulaExtraida = null;
    } else {
      base.scoreConfianca = resultado.scoreConfianca;
      base.alertas = resultado.alertas;
      base.dados = resultado.dados;
      base.clausulaExtraida = resultado.clausulaExtraida || null;
    }
    base.status = 'OK';
  } catch (err) {
    base.status = 'ERRO';
    base.erro = err?.message || String(err);
    base.classificacao = 'ERRO_LEITURA';
  }

  return base;
}

function gerarResumo(itens, opts) {
  const porClass = {};
  for (const it of itens) {
    const k = it.classificacao || it.status;
    porClass[k] = (porClass[k] || 0) + 1;
  }
  const honorarios = itens.filter((i) => i.classificacao === 'HONORARIOS_VILLAREAL');
  return {
    cliente: opts.cliente,
    procInicio: opts.procInicio,
    procFim: opts.procFim,
    geradoEm: new Date().toISOString(),
    totalProcessos: itens.length,
    comPdf: itens.filter((i) => i.arquivoSelecionado).length,
    honorariosVillaReal: honorarios.length,
    porClassificacao: porClass,
    scores: {
      mediaHonorarios:
        honorarios.length > 0
          ? Math.round(
              honorarios.reduce((s, i) => s + i.scoreConfianca, 0) / honorarios.length,
            )
          : null,
      abaixo50: itens.filter((i) => i.scoreConfianca > 0 && i.scoreConfianca < 50).length,
      entre50e79: itens.filter((i) => i.scoreConfianca >= 50 && i.scoreConfianca < 80).length,
      acima80: itens.filter((i) => i.scoreConfianca >= 80).length,
    },
  };
}

function gerarCsvLinhas(itens) {
  const header = [
    'numeroInterno',
    'classificacao',
    'status',
    'scoreConfianca',
    'tipoRemuneracao',
    'percentualProveito',
    'valorFixo',
    'quantidadeParcelas',
    'valorTotalParcelas',
    'primeiroVencimento',
    'dataContrato',
    'numeroCnjExtraido',
    'partesExtraidas',
    'parteOposta',
    'arquivo',
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
        d.tipoRemuneracao ?? '',
        d.percentualProveito ?? '',
        d.valorFixo ?? '',
        d.quantidadeParcelas ?? '',
        d.valorTotalParcelas ?? '',
        d.primeiroVencimento ?? '',
        d.dataContrato ?? '',
        d.numeroCnjExtraido ?? '',
        (d.partesExtraidas ?? '').replace(/;/g, ','),
        (it.parteOposta ?? '').replace(/;/g, ','),
        it.arquivoSelecionado ?? '',
        (it.alertas ?? []).join(' | ').replace(/;/g, ','),
      ].join(';'),
    );
  }
  return rows.join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Uso:
  node scripts/extrair-contrato-honorarios-lote.mjs --cliente 728 --proc-inicio 800 --proc-fim 999`);
    process.exit(0);
  }

  const pastaCliente = resolverPastaCliente(opts.cliente);
  const cod8 = path.basename(pastaCliente).slice(0, 8);
  const itens = [];

  console.error(`Cliente: ${cod8} (${pastaCliente})`);
  console.error(`Processos: ${opts.procInicio}..${opts.procFim}`);

  for (let n = opts.procInicio; n <= opts.procFim; n += 1) {
    const item = await processarProc(pastaCliente, n);
    item.codigoCliente = cod8;
    itens.push(item);
    if (opts.verbose || n % 25 === 0 || item.classificacao === 'HONORARIOS_VILLAREAL') {
      console.error(
        `  proc ${n}: ${item.classificacao || item.status} score=${item.scoreConfianca}`,
      );
    }
  }

  const payload = {
    resumo: gerarResumo(itens, opts),
    itens,
  };

  const stamp = `${opts.cliente}-${opts.procInicio}-${opts.procFim}`;
  const outDir = path.resolve('tmp/contratos-honorarios-lote');
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = opts.saida
    ? path.resolve(opts.saida)
    : path.join(outDir, `lote-${stamp}.json`);
  const csvPath = jsonPath.replace(/\.json$/i, '.csv');

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.writeFileSync(csvPath, gerarCsvLinhas(itens), 'utf8');

  console.error('\n=== Resumo ===');
  console.error(JSON.stringify(payload.resumo, null, 2));
  console.error(`\nJSON: ${jsonPath}`);
  console.error(`CSV:  ${csvPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
