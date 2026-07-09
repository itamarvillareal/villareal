#!/usr/bin/env node
/**
 * Primeira rodada de análise para revisão humana — cruza fila EM_REVISAO com
 * prioridade, extração estática e conciliação financeira.
 *
 * Uso:
 *   node scripts/analisar-revisao-contratos-fila.mjs --base-url=http://localhost:8080 --senha 123456
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loginImportApi } from './lib/vilareal-import-processo-api.mjs';

const REL = path.resolve('tmp/contratos-honorarios-inventario/relatorios');

function parseArgs(argv) {
  const out = {
    baseUrl: process.env.VILAREAL_API_BASE_LOCAL || 'http://localhost:8080',
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    lote: 50,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--base-url=')) out.baseUrl = a.slice('--base-url='.length).replace(/\/$/, '');
    else if (a === '--senha') out.senha = argv[++i];
    else if (a.startsWith('--lote=')) out.lote = Number(a.slice('--lote='.length));
  }
  return out;
}

function esc(v) {
  const s = String(v ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function normNome(s) {
  return String(s ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCsvSemicolon(file, cols) {
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').slice(1);
  return lines.map((line) => {
    const p = line.split(';');
    const o = {};
    cols.forEach((c, i) => {
      o[c] = p[i] ?? '';
    });
    return o;
  });
}

function flagsNome(nome) {
  const n = normNome(nome);
  return {
    naoIncluir: /n[aã]o\s*incluir|nao\s*incluir/.test(n),
    revogacao: /revogac/.test(n),
    duplicataProvavel: /\(1\)|c[oó]pia|copy/.test(n),
    inicialExecucao: /inicial|execu[cç][aã]o/.test(n),
  };
}

function avaliarDados(dados, item) {
  const alertas = [];
  const bloqueios = [];

  if (!dados?.tipoRemuneracao) bloqueios.push('sem_tipo_remuneracao');

  const tipo = dados?.tipoRemuneracao;
  if (tipo === 'VALOR_FIXO') {
    if (!dados.valorFixo) bloqueios.push('sem_valor_fixo');
    if (dados.temParcelamento && !dados.primeiroVencimento) alertas.push('parcelamento_sem_1o_vencimento');
    if (dados.temParcelamento && !dados.quantidadeParcelas) alertas.push('parcelamento_sem_qtd');
  }
  if (tipo === 'PERCENTUAL_PROVEITO' && !dados.percentualProveito) {
    alertas.push('sem_percentual');
  }
  if (tipo === 'MISTO') {
    if (!dados.percentualProveito && !dados.valorFixo) alertas.push('misto_sem_valores');
  }

  if (!dados?.dataContrato) alertas.push('sem_data_contrato');
  if (!dados?.objetoContrato) alertas.push('sem_objeto');
  if (dados?.temCasoVinculado && !item.processoId && !item.processoSugerido?.processoId) {
    bloqueios.push('caso_vinculado_sem_processo');
  }
  if (!item.codigoCliente) bloqueios.push('sem_codigo_cliente');
  if ((item.alertas || []).some((a) => /credit balance/i.test(a))) alertas.push('alerta_ia_credito');

  return { alertas, bloqueios };
}

function scoreRevisao(item, prio, fin, flags, qual) {
  let s = 0;
  const ext = prio?.scoreConfianca ? Number(prio.scoreConfianca) : 0;
  s += Math.min(ext, 100) * 0.4;

  if (prio?.classificacao === 'HONORARIOS_VILLAREAL') s += 25;
  else if (prio?.classificacao === 'HONORARIOS_PARCIAL') s += 10;

  const d = item.dadosAprovados ?? {};
  if (d.tipoRemuneracao === 'VALOR_FIXO' && d.valorFixo) s += 15;
  if (d.dataContrato) s += 5;
  if (item.processoId || item.processoSugerido?.processoId) s += 10;
  if (fin?.situacaoFinanceira?.startsWith('MATCH')) s += 15;
  else if (fin?.totalLancamentosProcesso > 0) s += 5;

  if (flags.naoIncluir) s -= 40;
  if (flags.revogacao) s -= 30;
  if (flags.inicialExecucao) s -= 25;
  if (flags.duplicataProvavel) s -= 10;
  if (qual.bloqueios.length) s -= 30;
  s -= qual.alertas.length * 2;

  return Math.round(Math.max(0, Math.min(100, s)));
}

function recomendacao(score, qual, flags) {
  if (qual.bloqueios.length) return 'BLOQUEADO';
  if (flags.naoIncluir || flags.revogacao || flags.inicialExecucao) return 'REJEITAR';
  if (score >= 75) return 'APROVAR_RAPIDO';
  if (score >= 55) return 'REVISAR';
  return 'REVISAR_DETALHADO';
}

async function listarFila(baseUrl, token, status) {
  const headers = { Authorization: `Bearer ${token}` };
  const all = [];
  let page = 0;
  while (true) {
    const r = await fetch(
      `${baseUrl}/api/documentos/contratos-honorarios/importar/fila?status=${status}&page=${page}&size=200`,
      { headers },
    );
    if (!r.ok) throw new Error(`fila ${r.status}`);
    const b = await r.json();
    all.push(...(b.content ?? []));
    if (b.last || !(b.content?.length)) break;
    page += 1;
  }
  return all;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.senha) {
    console.error('Use --senha ou VILAREAL_IMPORT_SENHA');
    process.exit(1);
  }

  const token = await loginImportApi(args.baseUrl, args.login, args.senha);
  const fila = await listarFila(args.baseUrl, token, 'EM_REVISAO');
  const extraido = await listarFila(args.baseUrl, token, 'EXTRAIDO');

  const prioRows = fs.existsSync(path.join(REL, '38-prioridade-revisao-importaveis.csv'))
    ? parseCsvSemicolon(path.join(REL, '38-prioridade-revisao-importaveis.csv'), [
        'prioridade',
        'codigoCliente',
        'numeroInterno',
        'nomeArquivo',
        'classificacao',
        'scoreConfianca',
        'tipoRemuneracao',
        'dataContrato',
        'enfileirado',
        'caminhoAbsoluto',
      ])
    : [];

  const prioByChave = new Map();
  for (const p of prioRows) {
    prioByChave.set(`${p.codigoCliente}::${normNome(p.nomeArquivo)}`, p);
  }

  const finRows = fs.existsSync(path.join(REL, '51-conciliacao-financeira-censo.csv'))
    ? parseCsvSemicolon(path.join(REL, '51-conciliacao-financeira-censo.csv'), [
        'codigoCliente',
        'numeroInterno',
        'processoId',
        'situacaoFinanceira',
        'tipoRemuneracao',
        'valorReferencia',
        'dataContrato',
        'saldoContaCorrente',
        'totalLancamentosProcesso',
        'creditosClienteOrfaos',
        'totalPagamentos',
        'importacaoId',
        'statusFila',
        'matchScore',
        'matchLancamentoId',
        'matchValor',
        'matchData',
        'matchVinculadoProcesso',
        'nomeArquivo',
        'caminhoAbsoluto',
      ])
    : [];

  const finByImportId = new Map();
  const finByChave = new Map();
  for (const f of finRows) {
    if (f.importacaoId) finByImportId.set(String(f.importacaoId), f);
    finByChave.set(`${f.codigoCliente}::${normNome(f.nomeArquivo)}`, f);
  }

  const analisados = [];
  for (const item of fila) {
    const chave = `${item.codigoCliente}::${normNome(item.pdfNomeArquivo)}`;
    const prio = prioByChave.get(chave);
    const fin = finByImportId.get(String(item.importacaoId)) ?? finByChave.get(chave);
    const flags = flagsNome(item.pdfNomeArquivo);
    const qual = avaliarDados(item.dadosAprovados, item);
    const score = scoreRevisao(item, prio, fin, flags, qual);
    const rec = recomendacao(score, qual, flags);
    const d = item.dadosAprovados ?? {};

    analisados.push({
      importacaoId: item.importacaoId,
      codigoCliente: item.codigoCliente,
      pdfNomeArquivo: item.pdfNomeArquivo,
      classificacaoExtracao: prio?.classificacao ?? null,
      scoreExtracao: prio?.scoreConfianca ?? null,
      scoreRevisao: score,
      recomendacao: rec,
      status: item.status,
      processoId: item.processoId ?? item.processoSugerido?.processoId ?? null,
      numeroInterno: item.processoSugerido?.numeroInterno ?? prio?.numeroInterno ?? null,
      numeroCnj: item.processoSugerido?.numeroCnj ?? d.numeroCnjExtraido ?? null,
      tipoRemuneracao: d.tipoRemuneracao,
      valorFixo: d.valorFixo,
      percentualProveito: d.percentualProveito,
      dataContrato: d.dataContrato,
      temParcelamento: d.temParcelamento,
      quantidadeParcelas: d.quantidadeParcelas,
      primeiroVencimento: d.primeiroVencimento,
      formaPagamento: d.formaPagamento,
      roteamentoTipo: item.roteamentoTipo,
      objetoContrato: (d.objetoContrato || '').slice(0, 120),
      situacaoFinanceira: fin?.situacaoFinanceira ?? null,
      matchScore: fin?.matchScore ?? null,
      totalLancamentosProcesso: fin?.totalLancamentosProcesso ?? null,
      bloqueios: qual.bloqueios.join('|'),
      alertasQualidade: qual.alertas.join('|'),
      flags: Object.entries(flags)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join('|'),
    });
  }

  analisados.sort((a, b) => b.scoreRevisao - a.scoreRevisao || a.importacaoId - b.importacaoId);

  const porRec = {};
  for (const a of analisados) porRec[a.recomendacao] = (porRec[a.recomendacao] || 0) + 1;

  const lote1 = analisados.filter((a) => a.recomendacao === 'APROVAR_RAPIDO').slice(0, args.lote);
  const revisar = analisados.filter((a) => a.recomendacao === 'REVISAR').slice(0, args.lote);
  const bloqueados = analisados.filter((a) => a.recomendacao === 'BLOQUEADO').slice(0, 30);

  const payload = {
    geradoEm: new Date().toISOString(),
    baseUrl: args.baseUrl,
    resumo: {
      emRevisao: fila.length,
      extraido: extraido.length,
      porRecomendacao: porRec,
      loteAprovarRapido: lote1.length,
    },
    loteAprovarRapido: lote1,
    amostraRevisar: revisar.slice(0, 15),
    amostraBloqueados: bloqueados.slice(0, 15),
    todos: analisados,
  };

  fs.mkdirSync(REL, { recursive: true });
  const jsonPath = path.join(REL, '52-primeira-rodada-revisao.json');
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  const cols = [
    'importacaoId',
    'scoreRevisao',
    'recomendacao',
    'codigoCliente',
    'numeroInterno',
    'processoId',
    'classificacaoExtracao',
    'scoreExtracao',
    'tipoRemuneracao',
    'valorFixo',
    'percentualProveito',
    'dataContrato',
    'quantidadeParcelas',
    'primeiroVencimento',
    'situacaoFinanceira',
    'matchScore',
    'bloqueios',
    'alertasQualidade',
    'flags',
    'pdfNomeArquivo',
    'objetoContrato',
  ];
  const csvPath = path.join(REL, '52-primeira-rodada-revisao.csv');
  const lines = [cols.join(';')];
  for (const a of analisados) lines.push(cols.map((c) => esc(a[c])).join(';'));
  fs.writeFileSync(csvPath, lines.join('\n'));

  const loteCsv = path.join(REL, '52-lote1-aprovar-rapido.csv');
  const loteLines = [cols.join(';')];
  for (const a of lote1) loteLines.push(cols.map((c) => esc(a[c])).join(';'));
  fs.writeFileSync(loteCsv, loteLines.join('\n'));

  const md = [
    '# Primeira rodada de revisão — análise',
    '',
    `Gerado: ${new Date().toLocaleString('pt-BR')}`,
    '',
    '## Resumo',
    '',
    `| Métrica | Valor |`,
    `|---|---|`,
    `| EM_REVISAO | ${fila.length} |`,
    `| EXTRAIDO (sem dados) | ${extraido.length} |`,
    ...Object.entries(porRec).map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '## Lote 1 — APROVAR_RAPIDO (top ' + lote1.length + ')',
    '',
    '| ID | Cliente | Proc | Score | Tipo | Valor | Data | Financeiro |',
    '|---|---|---|---|---|---|---|---|',
    ...lote1.slice(0, 25).map(
      (a) =>
        `| ${a.importacaoId} | ${a.codigoCliente} | ${a.numeroInterno ?? '—'} | ${a.scoreRevisao} | ${a.tipoRemuneracao} | ${a.valorFixo ?? a.percentualProveito ?? '—'} | ${a.dataContrato ?? '—'} | ${a.situacaoFinanceira ?? '—'} |`,
    ),
    '',
    '## Bloqueados (amostra)',
    '',
    ...bloqueados.slice(0, 10).map(
      (a) => `- **#${a.importacaoId}** ${a.codigoCliente} — ${a.bloqueios} — ${a.pdfNomeArquivo}`,
    ),
    '',
    'Arquivos: `52-primeira-rodada-revisao.csv`, `52-lote1-aprovar-rapido.csv`',
  ].join('\n');
  fs.writeFileSync(path.join(REL, '52-primeira-rodada-revisao.md'), md);

  console.log(JSON.stringify({ jsonPath, csvPath, loteCsv, resumo: payload.resumo }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
