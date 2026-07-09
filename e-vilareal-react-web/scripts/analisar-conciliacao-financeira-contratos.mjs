#!/usr/bin/env node
/**
 * Cruza contratos importáveis do censo com conta corrente (financeiro) e pagamentos.
 *
 * Uso:
 *   VILAREAL_IMPORT_SENHA='123456' node scripts/analisar-conciliacao-financeira-contratos.mjs
 *   node scripts/analisar-conciliacao-financeira-contratos.mjs --apenas-arquivo  # sem API
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  buscarProcesso,
  loginImportApi,
  resolverClienteFromApi,
} from './lib/vilareal-import-processo-api.mjs';

const DIR = path.resolve('tmp/contratos-honorarios-inventario');
const REL = path.join(DIR, 'relatorios');

const TOLERANCIA_VALOR = 1.0;
const MAX_DIAS_DATA = 30;
const MIN_SCORE = 3;

function parseArgs(argv) {
  const out = {
    baseUrl: process.env.VILAREAL_API_BASE_LOCAL || process.env.VILAREAL_IMPORT_BASE || 'http://localhost:8080',
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    apenasArquivo: false,
  };
  for (const a of argv) {
    if (a === '--apenas-arquivo') out.apenasArquivo = true;
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice('--base-url='.length).replace(/\/$/, '');
    else if (a === '--senha') out.senha = argv[argv.indexOf(a) + 1];
  }
  return out;
}

function esc(v) {
  const s = String(v ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function extrairNumeroInterno(caminho, csvNi) {
  if (csvNi != null && String(csvNi).trim() !== '') {
    const n = Number(csvNi);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  const m = String(caminho ?? '').match(/[/\\]Proc\.\s*0*(\d+)(?:[/\\]|$)/i);
  return m ? Number(m[1]) : null;
}

function diasEntre(a, b) {
  if (!a || !b) return null;
  const da = new Date(`${a}T12:00:00`);
  const db = new Date(`${b}T12:00:00`);
  return Math.round(Math.abs(da - db) / 86400000);
}

function scoreLancamentoParcela(parcelaValor, parcelaVenc, lanc) {
  if (lanc.natureza !== 'CREDITO') return 0;
  const valor = Math.abs(Number(lanc.valor) || 0);
  if (!parcelaValor || !valor) return 0;
  const diff = Math.abs(valor - parcelaValor);
  if (diff > TOLERANCIA_VALOR) return 0;
  let score = diff === 0 ? 4 : 2;
  const dias = diasEntre(parcelaVenc, lanc.dataLancamento);
  if (dias != null) {
    if (dias === 0) score += 2;
    else if (dias <= MAX_DIAS_DATA) score += 1;
  }
  if (lanc.processoId) score += 2;
  return score;
}

function parcelasEsperadas(dados) {
  if (!dados) return [];
  const out = [];
  const valor = Number(dados.valorFixo);
  const qtd = Number(dados.quantidadeParcelas) || (dados.temParcelamento && valor ? 12 : 0);
  const primeiro = dados.primeiroVencimento || dados.dataContrato;
  if (valor > 0 && qtd > 0 && primeiro) {
    let d = new Date(`${primeiro}T12:00:00`);
    for (let i = 1; i <= Math.min(qtd, 24); i += 1) {
      out.push({
        numero: i,
        valor,
        vencimento: d.toISOString().slice(0, 10),
      });
      d = new Date(d);
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }
  if (valor > 0) {
    out.push({ numero: 1, valor, vencimento: primeiro || null });
  }
  return out;
}

function carregarMasterImportaveis() {
  const csvPath = path.join(REL, '43-master-importaveis-unificado.csv');
  const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n').slice(1);
  return lines.map((line) => {
    const p = line.split(';');
    const [fonte, codigoCliente, extensao, numeroInterno, , nomeArquivo, classificacao, score, tipoRemuneracao, dataContrato, caminho] =
      p;
    return {
      fonte,
      codigoCliente,
      extensao,
      numeroInterno: extrairNumeroInterno(caminho, numeroInterno),
      nomeArquivo,
      classificacao,
      scoreConfianca: Number(score) || 0,
      tipoRemuneracao: tipoRemuneracao || null,
      dataContrato: dataContrato || null,
      caminhoAbsoluto: caminho,
    };
  });
}

function carregarEstaticoPorCaminho() {
  const p = path.join(REL, '50-extracao-estatica-censo.json');
  if (!fs.existsSync(p)) return new Map();
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const map = new Map();
  for (const it of j.itens ?? []) {
    if (it.caminhoAbsoluto) map.set(it.caminhoAbsoluto, it);
  }
  return map;
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
    all.push(...(b.content ?? []));
    if (b.last || !(b.content?.length)) break;
    page += 1;
  }
  return all;
}

async function fetchJson(url, token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!r.ok) return null;
  return r.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const itens = carregarMasterImportaveis();
  const estaticoMap = carregarEstaticoPorCaminho();

  let token = null;
  let fila = [];
  if (!args.apenasArquivo) {
    if (!args.senha) {
      console.error('Defina VILAREAL_IMPORT_SENHA ou --senha');
      process.exit(1);
    }
    token = await loginImportApi(args.baseUrl, args.login, args.senha);
    fila = await listarFila(args.baseUrl, token);
  }

  const filaPorCaminho = new Map();
  const filaPorChave = new Map();
  for (const f of fila) {
    const dados = f.dadosAprovados ?? f.dadosExtraidos ?? {};
    const entry = {
      importacaoId: f.importacaoId,
      processoId: f.processoId ?? f.processoSugerido?.processoId ?? null,
      numeroInterno: f.processoSugerido?.numeroInterno ?? null,
      dados,
      status: f.status,
    };
    if (f.pdfNomeArquivo) {
      filaPorChave.set(`${f.codigoCliente}::${f.pdfNomeArquivo}`, entry);
    }
  }

  const clienteCache = new Map();
  const processoCache = new Map();
  const lancProcCache = new Map();
  const lancCliCache = new Map();
  const resumoProcCache = new Map();
  const pagProcCache = new Map();
  const contratoProcCache = new Map();

  async function resolverProcesso(cod8, ni) {
    const key = `${cod8}:${ni ?? ''}`;
    if (processoCache.has(key)) return processoCache.get(key);
    let hit = null;
    if (token && ni) {
      hit = await buscarProcesso(args.baseUrl, token, cod8, ni, clienteCache);
    }
    processoCache.set(key, hit);
    return hit;
  }

  async function lancamentosProcesso(pid) {
    if (!pid || !token) return [];
    if (lancProcCache.has(pid)) return lancProcCache.get(pid);
    const rows = (await fetchJson(`${args.baseUrl}/api/financeiro/lancamentos?processoId=${pid}`, token)) ?? [];
    const creditos = rows.filter((l) => l.natureza === 'CREDITO');
    lancProcCache.set(pid, creditos);
    return creditos;
  }

  async function lancamentosCliente(clientePk) {
    if (!clientePk || !token) return [];
    if (lancCliCache.has(clientePk)) return lancCliCache.get(clientePk);
    const rows = (await fetchJson(`${args.baseUrl}/api/financeiro/lancamentos?clienteId=${clientePk}`, token)) ?? [];
    const creditos = rows.filter((l) => l.natureza === 'CREDITO');
    lancCliCache.set(clientePk, creditos);
    return creditos;
  }

  async function resumoProcesso(pid) {
    if (!pid || !token) return null;
    if (resumoProcCache.has(pid)) return resumoProcCache.get(pid);
    const r = await fetchJson(`${args.baseUrl}/api/financeiro/lancamentos/resumo-processo/${pid}`, token);
    resumoProcCache.set(pid, r);
    return r;
  }

  async function pagamentosProcesso(pid) {
    if (!pid || !token) return [];
    if (pagProcCache.has(pid)) return pagProcCache.get(pid);
    const rows = (await fetchJson(`${args.baseUrl}/api/pagamentos?processoId=${pid}`, token)) ?? [];
    pagProcCache.set(pid, Array.isArray(rows) ? rows : []);
    return pagProcCache.get(pid);
  }

  async function contratosProcesso(pid) {
    if (!pid || !token) return [];
    if (contratoProcCache.has(pid)) return contratoProcCache.get(pid);
    const rows = (await fetchJson(`${args.baseUrl}/api/documentos/contratos-honorarios?processoId=${pid}`, token)) ?? [];
    contratoProcCache.set(pid, Array.isArray(rows) ? rows : []);
    return contratoProcCache.get(pid);
  }

  const resultados = [];
  const stats = {
    total: itens.length,
    comProcessoResolvido: 0,
    comLancamentosProcesso: 0,
    comLancamentosClienteSemVinculo: 0,
    comMatchValor: 0,
    comPagamentos: 0,
    comContratoSistema: 0,
    semMovimentacao: 0,
    naFila: 0,
  };

  for (let i = 0; i < itens.length; i += 1) {
    const it = itens[i];
    const est = estaticoMap.get(it.caminhoAbsoluto);
    const filaHit = filaPorChave.get(`${it.codigoCliente}::${it.nomeArquivo}`);
    const dados = filaHit?.dados ?? est?.dadosApi ?? {
      tipoRemuneracao: it.tipoRemuneracao,
      dataContrato: it.dataContrato,
    };

    let processoId = filaHit?.processoId ?? null;
    let numeroInterno = it.numeroInterno ?? filaHit?.numeroInterno ?? null;
    let processo = null;
    let clientePk = null;

    if (token) {
      const cli = await resolverClienteFromApi(args.baseUrl, token, it.codigoCliente, clienteCache);
      clientePk = cli?.clientePk ?? null;
      if (!processoId && numeroInterno) {
        processo = await resolverProcesso(it.codigoCliente, numeroInterno);
        processoId = processo?.id ?? null;
      } else if (processoId) {
        processo = { id: processoId, numeroInterno, numeroCnj: dados.numeroCnjExtraido ?? null };
      }
      if (processoId) stats.comProcessoResolvido += 1;
    }

    const parcelas = parcelasEsperadas(dados);
    const valorRef = parcelas[0]?.valor ?? (Number(dados.valorFixo) || null);

    let lancProc = processoId ? await lancamentosProcesso(processoId) : [];
    let lancCli = clientePk ? await lancamentosCliente(clientePk) : [];
    const lancCliOrfaos = lancCli.filter((l) => !l.processoId);
    const resumo = processoId ? await resumoProcesso(processoId) : null;
    const pagamentos = processoId ? await pagamentosProcesso(processoId) : [];
    const contratosSistema = processoId ? await contratosProcesso(processoId) : [];

    const candidatos = [...lancProc, ...lancCliOrfaos];
    const matches = [];
    for (const parc of parcelas.length ? parcelas : [{ numero: null, valor: valorRef, vencimento: dados.primeiroVencimento }]) {
      if (!parc.valor) continue;
      for (const l of candidatos) {
        const score = scoreLancamentoParcela(parc.valor, parc.vencimento, l);
        if (score >= MIN_SCORE) {
          matches.push({
            parcela: parc.numero,
            valorEsperado: parc.valor,
            vencimentoEsperado: parc.vencimento,
            lancamentoId: l.id,
            valorLancamento: Math.abs(Number(l.valor)),
            dataLancamento: l.dataLancamento,
            processoIdLanc: l.processoId,
            descricao: (l.descricao || '').slice(0, 120),
            score,
            vinculadoAoProcesso: Boolean(l.processoId && l.processoId === processoId),
          });
        }
      }
    }

    matches.sort((a, b) => b.score - a.score);
    const melhor = matches[0] ?? null;

    let situacao = 'SEM_DADOS_API';
    if (!token) situacao = 'SEM_API';
    else if (contratosSistema.length > 0) {
      situacao = 'CONTRATO_JA_NO_SISTEMA';
      stats.comContratoSistema += 1;
    } else if (matches.length > 0) {
      situacao = melhor?.vinculadoAoProcesso ? 'MATCH_VINCULADO_PROCESSO' : 'MATCH_CLIENTE_SEM_VINCULO';
      stats.comMatchValor += 1;
      if (!melhor?.vinculadoAoProcesso) stats.comLancamentosClienteSemVinculo += 1;
    } else if (lancProc.length > 0) {
      situacao = 'CREDITOS_PROCESSO_SEM_MATCH_VALOR';
      stats.comLancamentosProcesso += 1;
    } else if (lancCliOrfaos.length > 0) {
      situacao = 'CREDITOS_CLIENTE_SEM_VINCULO';
      stats.comLancamentosClienteSemVinculo += 1;
    } else if (pagamentos.length > 0) {
      situacao = 'PAGAMENTOS_SEM_LANCAMENTO';
      stats.comPagamentos += 1;
    } else if (processoId) {
      situacao = 'SEM_MOVIMENTACAO';
      stats.semMovimentacao += 1;
    } else {
      situacao = 'PROCESSO_NAO_RESOLVIDO';
    }

    if (lancProc.length > 0 && !matches.length) stats.comLancamentosProcesso += 1;
    if (pagamentos.length > 0) stats.comPagamentos += 1;
    if (filaHit) stats.naFila += 1;

    resultados.push({
      codigoCliente: it.codigoCliente,
      numeroInterno,
      processoId,
      nomeArquivo: it.nomeArquivo,
      classificacao: it.classificacao,
      tipoRemuneracao: dados.tipoRemuneracao ?? it.tipoRemuneracao,
      valorReferencia: valorRef,
      dataContrato: dados.dataContrato ?? it.dataContrato,
      parcelasEsperadas: parcelas.length,
      importacaoId: filaHit?.importacaoId ?? null,
      statusFila: filaHit?.status ?? null,
      situacaoFinanceira: situacao,
      saldoContaCorrente: resumo?.saldo ?? null,
      totalLancamentosProcesso: resumo?.totalLancamentos ?? lancProc.length,
      creditosClienteOrfaos: lancCliOrfaos.length,
      totalPagamentos: pagamentos.length,
      contratosNoSistema: contratosSistema.length,
      melhorMatch: melhor,
      todosMatches: matches.slice(0, 5),
      caminhoAbsoluto: it.caminhoAbsoluto,
    });

    if ((i + 1) % 50 === 0) console.error(`  … ${i + 1}/${itens.length}`);
  }

  const porSituacao = {};
  for (const r of resultados) {
    porSituacao[r.situacaoFinanceira] = (porSituacao[r.situacaoFinanceira] || 0) + 1;
  }

  const destaque = resultados.filter(
    (r) =>
      r.situacaoFinanceira === 'MATCH_CLIENTE_SEM_VINCULO' ||
      r.situacaoFinanceira === 'MATCH_VINCULADO_PROCESSO' ||
      r.codigoCliente === '00000073',
  );

  const payload = {
    geradoEm: new Date().toISOString(),
    fonte: 'conta_corrente_api_local',
    baseUrl: args.apenasArquivo ? null : args.baseUrl,
    resumo: { ...stats, porSituacao },
    destaques: destaque.slice(0, 50),
    itens: resultados,
  };

  fs.mkdirSync(REL, { recursive: true });
  const jsonPath = path.join(REL, '51-conciliacao-financeira-censo.json');
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  const cols = [
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
  ];
  const csvLines = [cols.join(';')];
  for (const r of resultados) {
    const m = r.melhorMatch;
    csvLines.push(
      cols
        .map((c) => {
          if (c === 'matchScore') return esc(m?.score);
          if (c === 'matchLancamentoId') return esc(m?.lancamentoId);
          if (c === 'matchValor') return esc(m?.valorLancamento);
          if (c === 'matchData') return esc(m?.dataLancamento);
          if (c === 'matchVinculadoProcesso') return esc(m?.vinculadoAoProcesso);
          return esc(r[c]);
        })
        .join(';'),
    );
  }
  const csvPath = path.join(REL, '51-conciliacao-financeira-censo.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'));

  console.log(JSON.stringify({ jsonPath, csvPath, resumo: payload.resumo }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
