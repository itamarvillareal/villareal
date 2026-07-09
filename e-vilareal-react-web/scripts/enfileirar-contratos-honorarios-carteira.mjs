#!/usr/bin/env node
/**
 * Enfileira na API os contratos HONORARIOS_VILLAREAL extraídos do censo da carteira.
 *
 * Uso:
 *   VILAREAL_IMPORT_SENHA='…' node scripts/enfileirar-contratos-honorarios-carteira.mjs
 *   node scripts/enfileirar-contratos-honorarios-carteira.mjs --dry-run
 *   node scripts/enfileirar-contratos-honorarios-carteira.mjs --vps
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loginImportApi } from './lib/vilareal-import-processo-api.mjs';
import { resolverBaseUrlImport, verificarApiImportDisponivel } from './lib/vilareal-import-api-base.mjs';

const MANIFESTO_PADRAO =
  'tmp/contratos-honorarios-inventario/extracao-carteira-1-999-honor-pdf.json';

function parseArgs(argv) {
  const out = {
    manifesto: MANIFESTO_PADRAO,
    baseUrl: resolverBaseUrlImport(),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    dryRun: false,
    batchSize: 20,
    incluirParcial: false,
    saida: null,
    vps: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--manifest') out.manifesto = argv[++i];
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice('--base-url='.length).replace(/\/$/, '');
    else if (a === '--login') out.login = argv[++i];
    else if (a === '--senha') out.senha = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--vps') out.vps = true;
    else if (a === '--incluir-parcial') out.incluirParcial = true;
    else if (a.startsWith('--batch-size=')) out.batchSize = Number(a.slice('--batch-size='.length));
    else if (a === '--saida') out.saida = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  if (out.vps) out.baseUrl = resolverBaseUrlImport(process.env, { vps: true });
  return out;
}

function carregarItens(manifestoPath, incluirParcial) {
  const payload = JSON.parse(fs.readFileSync(manifestoPath, 'utf8'));
  const itens = payload.itens ?? payload;
  const classes = incluirParcial
    ? ['HONORARIOS_VILLAREAL', 'HONORARIOS_PARCIAL']
    : ['HONORARIOS_VILLAREAL'];
  return itens.filter(
    (x) =>
      classes.includes(x.classificacao) &&
      x.extensao === '.pdf' &&
      fs.existsSync(x.caminhoAbsoluto) &&
      x.tamanhoBytes > 0,
  );
}

async function uploadLote(baseUrl, token, arquivos, codigoCliente) {
  const form = new FormData();
  for (const arq of arquivos) {
    const buf = fs.readFileSync(arq.caminhoAbsoluto);
    const blob = new Blob([buf], { type: 'application/pdf' });
    form.append('arquivos', blob, arq.nomeArquivo);
  }
  if (codigoCliente) form.append('codigoCliente', codigoCliente);

  const res = await fetch(`${baseUrl}/api/documentos/contratos-honorarios/importar/lote`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Upload lote falhou ${res.status}: ${text.slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }
  return JSON.parse(text);
}

async function uploadUm(baseUrl, token, arq, codigoCliente) {
  return uploadLote(baseUrl, token, [arq], codigoCliente ?? arq.codigoCliente);
}

async function enfileirarComRetry(baseUrl, token, itens, batchSize) {
  const lotes = chunk(itens, batchSize);
  const resultados = [];
  const pendentes = [];
  let totalEnfileirados = 0;
  let totalDuplicados = 0;

  for (let i = 0; i < lotes.length; i += 1) {
    const lote = lotes[i];
    console.error(`  Upload lote ${i + 1}/${lotes.length} (${lote.length} PDFs)…`);
    try {
      const resp = await uploadLote(baseUrl, token, lote, null);
      totalEnfileirados += resp.enfileirados ?? 0;
      resultados.push({
        loteIndex: i + 1,
        loteId: resp.loteId,
        enfileirados: resp.enfileirados,
        limiteExcedido: resp.limiteExcedido,
      });
    } catch (err) {
      if (err.status !== 409) {
        resultados.push({ loteIndex: i + 1, erro: err.message });
        pendentes.push(...lote);
        continue;
      }
      console.error(`  Lote ${i + 1}: conflito — tentando arquivo a arquivo…`);
      for (const arq of lote) {
        try {
          const resp = await uploadUm(baseUrl, token, arq, arq.codigoCliente);
          totalEnfileirados += resp.enfileirados ?? 0;
          resultados.push({ arquivo: arq.nomeArquivo, loteId: resp.loteId, enfileirados: 1 });
        } catch (e) {
          if (e.status === 409) {
            totalDuplicados += 1;
            resultados.push({ arquivo: arq.nomeArquivo, duplicado: true });
          } else {
            pendentes.push(arq);
            resultados.push({ arquivo: arq.nomeArquivo, erro: e.message });
          }
        }
      }
    }
  }

  return { resultados, pendentes, totalEnfileirados, totalDuplicados };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Uso:
  VILAREAL_IMPORT_SENHA='…' node scripts/enfileirar-contratos-honorarios-carteira.mjs
  node scripts/enfileirar-contratos-honorarios-carteira.mjs --dry-run`);
    process.exit(0);
  }

  const manifestoPath = path.resolve(opts.manifesto);
  const itens = carregarItens(manifestoPath, opts.incluirParcial);
  console.error(`Manifesto: ${manifestoPath}`);
  console.error(`Itens para enfileirar: ${itens.length}`);

  const filaManifest = {
    geradoEm: new Date().toISOString(),
    total: itens.length,
    itens: itens.map((x) => ({
      codigoCliente: x.codigoCliente,
      codigoClienteNum: x.codigoClienteNum,
      numeroInterno: x.numeroInterno,
      nomeArquivo: x.nomeArquivo,
      classificacao: x.classificacao,
      scoreConfianca: x.scoreConfianca,
      dataContrato: x.dados?.dataContrato ?? null,
      tipoRemuneracao: x.dados?.tipoRemuneracao ?? null,
      caminhoAbsoluto: x.caminhoAbsoluto,
    })),
  };

  const outDir = path.resolve('tmp/contratos-honorarios-inventario');
  fs.mkdirSync(outDir, { recursive: true });
  const filaPath = opts.saida
    ? path.resolve(opts.saida)
    : path.join(outDir, 'fila-importacao-carteira-villa-real.json');
  fs.writeFileSync(filaPath, JSON.stringify(filaManifest, null, 2), 'utf8');
  console.error(`Fila local: ${filaPath}`);

  if (opts.dryRun) {
    console.error('\n=== Dry-run — nenhum upload ===');
    console.error(JSON.stringify({ total: itens.length, filaPath }, null, 2));
    return;
  }

  if (!opts.senha) {
    throw new Error('Defina VILAREAL_IMPORT_SENHA ou --senha');
  }

  await verificarApiImportDisponivel(opts.baseUrl);
  const token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
  console.error(`API: ${opts.baseUrl}`);

  const { resultados, pendentes, totalEnfileirados, totalDuplicados } = await enfileirarComRetry(
    opts.baseUrl,
    token,
    itens,
    opts.batchSize,
  );

  const resumoPath = path.join(outDir, 'fila-importacao-carteira-resultado.json');
  const resumo = {
    geradoEm: new Date().toISOString(),
    api: opts.baseUrl,
    totalSolicitado: itens.length,
    totalEnfileirados,
    totalDuplicados,
    totalPendentes: pendentes.length,
    lotes: resultados,
    pendentes: pendentes.map((x) => x.nomeArquivo),
  };
  fs.writeFileSync(resumoPath, JSON.stringify(resumo, null, 2), 'utf8');

  console.error('\n=== Enfileiramento ===');
  console.error(JSON.stringify(resumo, null, 2));
  console.error(`\nResultado: ${resumoPath}`);
  console.error('A extração IA roda no job do backend (fila → EXTRAIDO → revisão na UI).');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
