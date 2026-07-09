#!/usr/bin/env node
/**
 * Consolida extração heurística do censo (sem IA) e sincroniza na fila local via API.
 *
 * Uso:
 *   node scripts/sincronizar-extracao-heuristica-estatica.mjs --apenas-arquivo
 *   VILAREAL_IMPORT_SENHA='…' node scripts/sincronizar-extracao-heuristica-estatica.mjs --base-url=http://localhost:8080
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loginImportApi } from './lib/vilareal-import-processo-api.mjs';

const DIR = path.resolve('tmp/contratos-honorarios-inventario');
const REL = path.join(DIR, 'relatorios');

function parseArgs(argv) {
  const out = {
    baseUrl: process.env.VILAREAL_API_BASE || 'http://localhost:8080',
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    apenasArquivo: false,
    minScore: 0,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apenas-arquivo') out.apenasArquivo = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice('--base-url='.length).replace(/\/$/, '');
    else if (a === '--senha') out.senha = argv[++i];
    else if (a.startsWith('--min-score=')) out.minScore = Number(a.slice('--min-score='.length));
  }
  return out;
}

function normNome(s) {
  return String(s ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function chave(codigoCliente, nomeArquivo) {
  return `${codigoCliente}::${normNome(nomeArquivo)}`;
}

function dadosParaApi(dados, clausulaExtraida) {
  if (!dados?.tipoRemuneracao) return null;
  return {
    tipoRemuneracao: dados.tipoRemuneracao,
    percentualProveito: dados.percentualProveito ?? null,
    valorFixo: dados.valorFixo ?? null,
    temParcelamento: Boolean(dados.temParcelamento),
    gerarRecebiveis: Boolean(dados.gerarRecebiveis),
    quantidadeParcelas: dados.quantidadeParcelas ?? null,
    valorTotalParcelas: dados.valorTotalParcelas ?? null,
    primeiroVencimento: dados.primeiroVencimento ?? null,
    intervaloParcelas: dados.intervaloParcelas ?? null,
    formaPagamento: dados.formaPagamento ?? null,
    parcelas: [],
    dataContrato: dados.dataContrato ?? null,
    objetoContrato: dados.objetoContrato ?? null,
    formaAssinatura: dados.formaAssinatura ?? 'duas_vias',
    numeroCnjExtraido: dados.numeroCnjExtraido ?? null,
    partesExtraidas: dados.partesExtraidas ?? null,
    valorCausaExtraido: dados.valorCausaExtraido ?? null,
    temCasoVinculado: Boolean(dados.temCasoVinculado),
    clausulaExtraidaTexto: clausulaExtraida || null,
  };
}

function roteamento(dados) {
  return dados?.temCasoVinculado ? 'HONORARIOS' : 'MENSALISTA';
}

function esc(v) {
  const s = String(v ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function carregarIndiceEstatico() {
  const idx = new Map();
  const porCaminho = new Map();

  const cons = JSON.parse(fs.readFileSync(path.join(DIR, 'extracao-carteira-1-999-consolidado.json'), 'utf8'));
  for (const it of cons.itens) {
    if (!['HONORARIOS_VILLAREAL', 'HONORARIOS_PARCIAL'].includes(it.classificacao)) continue;
    const api = dadosParaApi(it.dados, it.clausulaExtraida);
    const entry = {
      codigoCliente: it.codigoCliente,
      nomeArquivo: it.nomeArquivo,
      caminhoAbsoluto: it.caminhoAbsoluto,
      classificacao: it.classificacao,
      scoreConfianca: it.scoreConfianca ?? 0,
      fonte: it.origemExtracao === 'ocr' ? 'pdf_ocr' : 'pdf_texto',
      dadosApi: api,
      roteamentoTipo: api ? roteamento(api) : null,
    };
    idx.set(chave(it.codigoCliente, it.nomeArquivo), entry);
    if (it.caminhoAbsoluto) porCaminho.set(it.caminhoAbsoluto, entry);
  }

  const docCsv = path.join(REL, '33-doc-docx-importaveis-ampliado.csv');
  if (fs.existsSync(docCsv)) {
    const lines = fs.readFileSync(docCsv, 'utf8').trim().split('\n').slice(1);
    for (const line of lines) {
      const p = line.split(';');
      const [codigo, , , nome, classificacao, score, tipo, , caminho] = p;
      const dados = {
        tipoRemuneracao: tipo || null,
        temCasoVinculado: false,
        formaAssinatura: 'duas_vias',
      };
      const api = dadosParaApi(dados, '');
      if (!api && classificacao.includes('HONOR')) {
        /* mantém registro mesmo sem tipo */
      }
      const key = chave(codigo, nome);
      if (!idx.has(key)) {
        idx.set(key, {
          codigoCliente: codigo,
          nomeArquivo: nome,
          caminhoAbsoluto: caminho,
          classificacao,
          scoreConfianca: Number(score) || 0,
          fonte: 'doc_textutil',
          dadosApi: api,
          roteamentoTipo: api ? roteamento(api) : 'MENSALISTA',
        });
      }
    }
  }

  return { idx, porCaminho };
}

function carregarMapaEnfileiramento() {
  const porCaminho = new Map();
  const porChave = new Map();
  for (const f of [
    'fila-importacao-carteira-villa-real.json',
    'fila-importacao-carteira-ocr.json',
    'fila-importacao-carteira-pendentes.json',
  ]) {
    const p = path.join(DIR, f);
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const it of j.itens ?? []) {
      if (it.caminhoAbsoluto) porCaminho.set(it.caminhoAbsoluto, it);
      porChave.set(chave(it.codigoCliente, it.nomeArquivo), it);
    }
  }
  return { porCaminho, porChave };
}

function resolverEstatico(item, idx, porCaminhoEstatico, mapaEnfileirado) {
  let est = idx.get(chave(item.codigoCliente, item.pdfNomeArquivo));
  if (est) return est;
  const enq = mapaEnfileirado.porChave.get(chave(item.codigoCliente, item.pdfNomeArquivo));
  if (enq?.caminhoAbsoluto) est = porCaminhoEstatico.get(enq.caminhoAbsoluto);
  if (est) return est;
  for (const [caminho, e] of porCaminhoEstatico) {
    if (normNome(path.basename(caminho)) === normNome(item.pdfNomeArquivo)) {
      if (!item.codigoCliente || e.codigoCliente === item.codigoCliente) return e;
    }
  }
  return null;
}

async function listarFila(baseUrl, token) {
  const headers = { Authorization: `Bearer ${token}` };
  const all = [];
  let page = 0;
  while (true) {
    const r = await fetch(`${baseUrl}/api/documentos/contratos-honorarios/importar/fila?page=${page}&size=200`, {
      headers,
    });
    if (!r.ok) throw new Error(`fila ${r.status}`);
    const b = await r.json();
    const chunk = b.content ?? [];
    all.push(...chunk);
    if (b.last || chunk.length < 200) break;
    page += 1;
  }
  return all;
}

async function salvarRevisao(baseUrl, token, importacaoId, body) {
  const r = await fetch(`${baseUrl}/api/documentos/contratos-honorarios/importar/${importacaoId}/revisao`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`revisao ${importacaoId} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { idx, porCaminho } = carregarIndiceEstatico();
  const estaticos = [...idx.values()].filter((x) => x.dadosApi != null);

  const payload = {
    geradoEm: new Date().toISOString(),
    fonte: 'heuristica_node_censo_sem_ia',
    totalRegistros: idx.size,
    comDadosApi: estaticos.length,
    itens: [...idx.values()],
  };

  fs.mkdirSync(REL, { recursive: true });
  const jsonPath = path.join(REL, '50-extracao-estatica-censo.json');
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

  const csvHeader = [
    'codigoCliente',
    'nomeArquivo',
    'classificacao',
    'score',
    'fonte',
    'tipoRemuneracao',
    'percentualProveito',
    'valorFixo',
    'dataContrato',
    'numeroCnj',
    'partes',
    'roteamento',
    'caminhoAbsoluto',
  ];
  const csvRows = [...idx.values()].map((x) => [
    x.codigoCliente,
    x.nomeArquivo,
    x.classificacao,
    x.scoreConfianca,
    x.fonte,
    x.dadosApi?.tipoRemuneracao ?? '',
    x.dadosApi?.percentualProveito ?? '',
    x.dadosApi?.valorFixo ?? '',
    x.dadosApi?.dataContrato ?? '',
    x.dadosApi?.numeroCnjExtraido ?? '',
    x.dadosApi?.partesExtraidas ?? '',
    x.roteamentoTipo ?? '',
    x.caminhoAbsoluto,
  ]);
  const csvPath = path.join(REL, '50-extracao-estatica-censo.csv');
  fs.writeFileSync(csvPath, [csvHeader.join(';'), ...csvRows.map((r) => r.map(esc).join(';'))].join('\n'), 'utf8');

  console.error(`Estático: ${idx.size} registros, ${estaticos.length} com dados API`);
  console.error(`  ${jsonPath}`);
  console.error(`  ${csvPath}`);

  if (opts.apenasArquivo) return;

  if (!opts.senha) throw new Error('Defina VILAREAL_IMPORT_SENHA ou use --apenas-arquivo');
  const token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
  const fila = await listarFila(opts.baseUrl, token);
  const mapaEnfileirado = carregarMapaEnfileiramento();

  let syncOk = 0;
  let semMatch = 0;
  let semDados = 0;
  let erros = 0;
  const log = [];

  for (const item of fila) {
    const est = resolverEstatico(item, idx, porCaminho, mapaEnfileirado);
    if (!est) {
      semMatch += 1;
      log.push({
        importacaoId: item.importacaoId,
        status: 'sem_match',
        codigo: item.codigoCliente,
        nome: item.pdfNomeArquivo,
      });
      continue;
    }
    if (!est.dadosApi || est.scoreConfianca < opts.minScore) {
      semDados += 1;
      log.push({ importacaoId: item.importacaoId, status: 'sem_dados', score: est.scoreConfianca });
      continue;
    }
    const body = {
      dadosAprovados: est.dadosApi,
      roteamentoTipo: est.roteamentoTipo,
      processoId: item.processoSugerido?.processoId ?? null,
    };
    if (opts.dryRun) {
      syncOk += 1;
      continue;
    }
    try {
      await salvarRevisao(opts.baseUrl, token, item.importacaoId, body);
      syncOk += 1;
      log.push({ importacaoId: item.importacaoId, status: 'ok', classificacao: est.classificacao });
    } catch (e) {
      erros += 1;
      log.push({ importacaoId: item.importacaoId, status: 'erro', erro: e.message });
    }
  }

  const resumo = {
    geradoEm: new Date().toISOString(),
    filaTotal: fila.length,
    syncOk,
    semMatch,
    semDados,
    erros,
  };
  fs.writeFileSync(path.join(REL, '50-sync-fila-local-resumo.json'), JSON.stringify(resumo, null, 2), 'utf8');
  fs.writeFileSync(path.join(REL, '50-sync-fila-local-log.json'), JSON.stringify(log, null, 2), 'utf8');
  console.error('\n=== Sync fila local (heurística estática) ===');
  console.error(JSON.stringify(resumo, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
