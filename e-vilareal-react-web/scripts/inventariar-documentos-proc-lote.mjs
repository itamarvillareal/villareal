#!/usr/bin/env node
/**
 * Varredura COMPLETA de pastas/subpastas — inventário + padrões de nome + seleção para leitura.
 * Não lê o conteúdo dos PDFs (fase 1). Gera manifesto do que será lido na fase 2.
 *
 * Uso:
 *   node scripts/inventariar-documentos-proc-lote.mjs --cliente 728 --proc-inicio 800 --proc-fim 999
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  classificarNomeArquivo,
  normalizarNomeParaPadrao,
  EXTENSOES_INVENTARIO,
  PADROES_CANDIDATO_CONTRATO,
  PADROES_EXCLUIR_LEITURA,
  PADROES_HONOR_PROCESSUAL,
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
    incluirRaizCliente: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--cliente') out.cliente = argv[++i];
    else if (a === '--proc-inicio') out.procInicio = Number(argv[++i]);
    else if (a === '--proc-fim') out.procFim = Number(argv[++i]);
    else if (a === '--saida') out.saida = argv[++i];
    else if (a === '--incluir-raiz-cliente') out.incluirRaizCliente = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function resolverPastaCliente(codigo) {
  const key = String(codigo).replace(/^0+/, '') || codigo;
  if (CLIENTES_DRIVE[key]) return path.join(DRIVE_BASE, CLIENTES_DRIVE[key]);
  const cod8 = String(codigo).padStart(8, '0');
  const hit = fs
    .readdirSync(DRIVE_BASE, { withFileTypes: true })
    .find((e) => e.isDirectory() && e.name.startsWith(`${cod8} -`));
  if (!hit) throw new Error(`Cliente ${codigo} não encontrado`);
  return path.join(DRIVE_BASE, hit.name);
}

/** Varre recursivamente sem limite de profundidade e sem pular pastas. */
function varrerArquivosCompleto(raiz) {
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
        pastaRelativa: path.relative(raiz, path.dirname(full)),
        profundidade: path.relative(raiz, full).split(path.sep).length - 1,
      });
    }
  }
  walk(raiz);
  return arquivos;
}

function resolverProcDir(pastaCliente, n) {
  const nomes = [
    `Proc. ${n}`,
    `Proc. ${String(n).padStart(2, '0')}`,
  ];
  const vistos = new Set();
  for (const nome of nomes) {
    if (vistos.has(nome)) continue;
    vistos.add(nome);
    const full = path.join(pastaCliente, nome);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function analisarPadroes(documentos) {
  const porPadrao = new Map();
  for (const doc of documentos) {
    const padrao = normalizarNomeParaPadrao(doc.nomeArquivo);
    const prev = porPadrao.get(padrao) ?? { padrao, ocorrencias: 0, exemplos: [], selecionadosLeitura: 0 };
    prev.ocorrencias += 1;
    if (prev.exemplos.length < 3) prev.exemplos.push(doc.nomeArquivo);
    if (doc.selecionadoLeitura) prev.selecionadosLeitura += 1;
    porPadrao.set(padrao, prev);
  }
  return [...porPadrao.values()].sort((a, b) => b.ocorrencias - a.ocorrencias);
}

function registrarDocumento(todosDocumentos, pastaCliente, cod8, numeroInterno, arq) {
  const cls = classificarNomeArquivo(arq.nomeArquivo, {
    caminhoAbsoluto: arq.caminhoAbsoluto,
    pastaCliente,
  });
  const selecionadoLeitura =
    cls.candidato != null &&
    cls.prioridadeLeitura != null &&
    cls.prioridadeLeitura <= 4 &&
    arq.tamanhoBytes > 0;
  todosDocumentos.push({
    codigoCliente: cod8,
    numeroInterno,
    ...arq,
    padraoNormalizado: normalizarNomeParaPadrao(arq.nomeArquivo),
    classificacaoNome: cls,
    selecionadoLeitura,
    prioridadeLeitura: cls.prioridadeLeitura,
    motivoSelecao: cls.motivo,
  });
}

function varrerRaizCliente(pastaCliente) {
  const arquivos = [];
  let entries;
  try {
    entries = fs.readdirSync(pastaCliente, { withFileTypes: true });
  } catch {
    return arquivos;
  }
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!EXTENSOES_INVENTARIO.includes(ext)) continue;
    const full = path.join(pastaCliente, ent.name);
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
      pastaRelativa: '(raiz cliente)',
      profundidade: 0,
    });
  }
  return arquivos;
}

function gerarCsv(documentos) {
  const header = [
    'numeroInterno',
    'selecionadoLeitura',
    'prioridadeLeitura',
    'motivoSelecao',
    'nomeArquivo',
    'pastaRelativa',
    'profundidade',
    'tamanhoBytes',
    'padraoNormalizado',
    'caminhoAbsoluto',
  ];
  const rows = [header.join(';')];
  for (const d of documentos) {
    rows.push(
      [
        d.numeroInterno,
        d.selecionadoLeitura ? 'SIM' : 'NAO',
        d.prioridadeLeitura ?? '',
        d.motivoSelecao,
        d.nomeArquivo,
        d.pastaRelativa,
        d.profundidade,
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
  node scripts/inventariar-documentos-proc-lote.mjs --cliente 728 --proc-inicio 800 --proc-fim 999`);
    process.exit(0);
  }

  const pastaCliente = resolverPastaCliente(opts.cliente);
  const cod8 = path.basename(pastaCliente).slice(0, 8);
  const todosDocumentos = [];
  const procsSemPasta = [];
  const procsVazios = [];

  console.error(`Inventário completo: ${cod8}, proc ${opts.procInicio}..${opts.procFim}`);

  for (let n = opts.procInicio; n <= opts.procFim; n += 1) {
    const procDir = resolverProcDir(pastaCliente, n);
    if (!procDir) {
      procsSemPasta.push(n);
      continue;
    }
    const arquivos = varrerArquivosCompleto(procDir);
    if (arquivos.length === 0) procsVazios.push(n);

    for (const arq of arquivos) {
      registrarDocumento(todosDocumentos, pastaCliente, cod8, n, arq);
    }
    if (n % 50 === 0) console.error(`  ... proc ${n} (${todosDocumentos.length} arquivos até agora)`);
  }

  if (opts.incluirRaizCliente) {
    const raizArquivos = varrerRaizCliente(pastaCliente);
    console.error(`  ... raiz cliente (${raizArquivos.length} arquivos)`);
    for (const arq of raizArquivos) {
      registrarDocumento(todosDocumentos, pastaCliente, cod8, 0, arq);
    }
  }

  const selecionados = todosDocumentos.filter((d) => d.selecionadoLeitura);
  const padroesDescobertos = analisarPadroes(todosDocumentos);
  const padroesSelecionados = padroesDescobertos.filter((p) => p.selecionadosLeitura > 0);

  const porMotivo = {};
  for (const d of todosDocumentos) {
    const k = d.motivoSelecao.split(':')[0];
    porMotivo[k] = (porMotivo[k] || 0) + 1;
  }
  const porPasta = {};
  for (const d of todosDocumentos) {
    const seg = d.pastaRelativa.split(path.sep)[0] || '(raiz proc)';
    porPasta[seg] = (porPasta[seg] || 0) + 1;
  }

  const payload = {
    resumo: {
      codigoCliente: cod8,
      procInicio: opts.procInicio,
      procFim: opts.procFim,
      geradoEm: new Date().toISOString(),
      totalArquivos: todosDocumentos.length,
      totalPdf: todosDocumentos.filter((d) => d.extensao === '.pdf').length,
      totalDocx: todosDocumentos.filter((d) => d.extensao === '.docx').length,
      selecionadosLeitura: selecionados.length,
      arquivosVazios: todosDocumentos.filter((d) => d.tamanhoBytes === 0).length,
      procsSemPasta: procsSemPasta.length,
      procsVazios: procsVazios.length,
      porMotivoSelecao: porMotivo,
      topPastasNivel1: Object.entries(porPasta)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([nome, qtd]) => ({ nome, qtd })),
    },
    padroesConfigurados: {
      candidatoContrato: PADROES_CANDIDATO_CONTRATO.map((p) => p.id),
      honorProcessual: PADROES_HONOR_PROCESSUAL.map((p) => p.id),
      excluirLeitura: PADROES_EXCLUIR_LEITURA.map((p) => p.id),
    },
    padroesDescobertos: padroesDescobertos.slice(0, 80),
    padroesSelecionadosLeitura: padroesSelecionados.slice(0, 50),
    procsSemPasta,
    procsVazios,
    candidatosLeitura: selecionados.map((d) => ({
      numeroInterno: d.numeroInterno,
      prioridadeLeitura: d.prioridadeLeitura,
      motivoSelecao: d.motivoSelecao,
      nomeArquivo: d.nomeArquivo,
      pastaRelativa: d.pastaRelativa,
      profundidade: d.profundidade,
      tamanhoBytes: d.tamanhoBytes,
      padraoNormalizado: d.padraoNormalizado,
      caminhoAbsoluto: d.caminhoAbsoluto,
    })),
    inventarioCompleto: todosDocumentos,
  };

  const stamp = `${opts.cliente}-${opts.procInicio}-${opts.procFim}`;
  const outDir = path.resolve('tmp/contratos-honorarios-inventario');
  fs.mkdirSync(outDir, { recursive: true });
  const basePath = opts.saida
    ? path.resolve(opts.saida).replace(/\.json$/i, '')
    : path.join(outDir, `inventario-${stamp}`);

  fs.writeFileSync(`${basePath}.json`, JSON.stringify(payload, null, 2), 'utf8');
  fs.writeFileSync(`${basePath}-candidatos.json`, JSON.stringify(payload.candidatosLeitura, null, 2), 'utf8');
  fs.writeFileSync(`${basePath}-padroes.json`, JSON.stringify({
    padroesDescobertos: payload.padroesDescobertos,
    padroesSelecionadosLeitura: payload.padroesSelecionadosLeitura,
  }, null, 2), 'utf8');
  fs.writeFileSync(`${basePath}.csv`, gerarCsv(todosDocumentos), 'utf8');
  fs.writeFileSync(`${basePath}-candidatos.csv`, gerarCsv(selecionados), 'utf8');

  console.error('\n=== Resumo inventário ===');
  console.error(JSON.stringify(payload.resumo, null, 2));
  console.error(`\nTop padrões selecionados para leitura:`);
  for (const p of padroesSelecionados.slice(0, 12)) {
    console.error(`  ${p.ocorrencias}x  ${p.padrao}`);
  }
  console.error(`\nArquivos:`);
  console.error(`  ${basePath}.json`);
  console.error(`  ${basePath}-candidatos.json  (${selecionados.length} para leitura)`);
  console.error(`  ${basePath}-padroes.json`);
  console.error(`  ${basePath}.csv`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
