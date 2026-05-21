#!/usr/bin/env node
/**
 * Importa agenda legado a partir dos .txt em `Banco de Dados/Agenda`.
 *
 * Espelha a macro VBA `Carregar_Agenda_Total`: para cada dia e linha 1–23 lê
 * `{Usuario}.{dd}.{mm}.{yyyy}.{linha}.{Hora|Compromisso|Status}.Agenda.txt`
 * e grava o slot se pelo menos um dos três não estiver vazio.
 *
 * Pastas (sem subpasta Milhar/Centena de cliente):
 *   Agenda/{Dr. Itamar|KARLA|Ana Luisa}/{Ano}/{MM - Mês}/*.txt
 *
 * Regra de negócio (legado): compromisso pode ter só descrição — hora em branco (tarefa do dia
 * sem horário fixo) e status em branco (ainda não cumprido; `OK` = cumprido).
 *
 * `--aplicar`: POST se não existir na API, PUT se existir e diferir; ignora duplicados (txt e API).
 *
 * Uso:
 *   node scripts/import-agenda-local-txt.mjs --dry-run
 *   node scripts/import-agenda-local-txt.mjs --validar-amostra=1000 --relatorio=tmp/validar-agenda.json
 *   VILAREAL_API_BASE=http://localhost:8081 VILAREAL_IMPORT_SENHA='…' \
 *     node scripts/import-agenda-local-txt.mjs --aplicar --login=itamar
 *
 * Opções:
 *   --base-agenda=PATH     Raiz Agenda (defeito: VILAREAL_BANCO_DADOS_BASE/Agenda ou ~/Dropbox/.../Agenda)
 *   --dry-run | --aplicar
 *   --ano-min= --ano-max=
 *   --data-min= --data-max=   AAAA-MM-DD
 *   --usuario-pasta=         Repetível; ex. --usuario-pasta="Dr. Itamar"
 *   --relatorio=JSON
 *   --exportar-xls=PATH      Gera planilha (colunas D/F/H/J/X como na macro)
 *   --concurrency=N
 *   --login= --senha= --base-url=
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

import {
  USUARIOS_AGENDA_PASTA,
  chaveConteudoEvento,
  compararEventoComReferenciaDia,
  compromissosEquivalentes,
  descricaoComoNaApi,
  indexarReferenciaDiaLegado,
  levantarEventosAgenda,
  normalizarHoraAgendaTxt,
  normalizarStatusAgendaTxt,
  normalizarStrAgenda,
  resolverBaseAgenda,
  temDescricaoUtil,
} from './lib/agenda-local-txt.mjs';

/** Pastas Dropbox → chaves extra para casar com GET /api/usuarios */
const ALIASES_PASTA_AGENDA = {
  'Dr. Itamar': ['dr itamar', 'dr. itamar', 'itamar', 'dr itamar villareal'],
  KARLA: ['karla', 'karla pedroza'],
  'Ana Luisa': ['ana luisa', 'ana luísa', 'ana.luisa'],
};

function normChave(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function construirMapaUsuariosPorChave(usuarios) {
  const map = new Map();
  const conflitos = [];

  function add(rawKey, id) {
    if (rawKey == null || rawKey === '') return;
    const k = normChave(rawKey);
    if (!k) return;
    const prev = map.get(k);
    if (prev != null && prev !== id) {
      conflitos.push({ chave: k, id1: prev, id2: id });
      return;
    }
    map.set(k, id);
  }

  for (const u of usuarios) {
    if (!u || u.ativo === false) continue;
    const id = u.id;
    add(u.login, id);
    add(String(u.login ?? '').replace(/[._-]+/g, ' '), id);
    add(u.nome, id);
    add(u.nomePessoa, id);
    add(u.apelido, id);
    if (u.nome) {
      const tokens = String(u.nome).trim().split(/\s+/).filter(Boolean);
      add(tokens[0], id);
      if (tokens.length >= 2) add(`${tokens[0]} ${tokens[1]}`, id);
    }
    if (u.nomePessoa) {
      const tokens = String(u.nomePessoa).trim().split(/\s+/).filter(Boolean);
      add(tokens[0], id);
      if (tokens.length >= 2) add(`${tokens[0]} ${tokens[1]}`, id);
    }
  }
  return { map, conflitos };
}

/** Evita importar só status OK sem texto (viraria «Compromisso» duplicado na API). */
function eventoImportavel(ev) {
  if (temDescricaoUtil(ev.descricao)) return true;
  if (normalizarHoraAgendaTxt(ev.horaEvento)) return true;
  return false;
}

function buildBodyAgenda(L, origem, processoRef = null) {
  return {
    usuarioId: L.usuarioId,
    dataEvento: L.dataEvento,
    horaEvento: L.horaEvento ?? null,
    descricao: temDescricaoUtil(L.descricao) ? String(L.descricao).trim().slice(0, 2000) : '',
    statusCurto: L.statusCurto ?? null,
    processoRef,
    origem,
  };
}

function resolverUsuarioIdPasta(usuarioPasta, mapa) {
  const aliases = [usuarioPasta, ...(ALIASES_PASTA_AGENDA[usuarioPasta] ?? [])];
  for (const a of aliases) {
    const id = mapa.get(normChave(a));
    if (id != null) return id;
  }
  return null;
}

function parseArgs(argv) {
  const out = {
    baseAgenda: resolverBaseAgenda(),
    dryRun: true,
    aplicar: false,
    anoMin: null,
    anoMax: null,
    dataMin: null,
    dataMax: null,
    usuariosPasta: [...USUARIOS_AGENDA_PASTA],
    relatorio: null,
    exportarXls: null,
    validarAmostra: null,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    concurrency: Math.min(
      32,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 8) || 8)
    ),
    seed: Number(process.env.VILAREAL_VALIDAR_SEED) || 42,
  };

  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a.startsWith('--base-agenda=')) out.baseAgenda = a.slice(14);
    else if (a.startsWith('--ano-min=')) out.anoMin = Number(a.slice(10));
    else if (a.startsWith('--ano-max=')) out.anoMax = Number(a.slice(10));
    else if (a.startsWith('--data-min=')) out.dataMin = a.slice(11).trim();
    else if (a.startsWith('--data-max=')) out.dataMax = a.slice(11).trim();
    else if (a.startsWith('--usuario-pasta=')) out.usuariosPasta.push(a.slice(16).trim());
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--exportar-xls=')) out.exportarXls = a.slice(15);
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--seed=')) out.seed = Number(a.slice(7)) || 42;
    else if (a.startsWith('--validar-amostra=')) {
      const n = Number(a.slice(18));
      if (Number.isFinite(n) && n > 0) out.validarAmostra = Math.trunc(n);
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(32, Math.floor(n));
    }
  }
  return out;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function amostraAleatoria(arr, n, seed) {
  if (arr.length <= n) return [...arr];
  const rnd = mulberry32(seed);
  const idx = arr.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).map((i) => arr[i]);
}

async function loginObterToken(opts) {
  const loginRes = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: String(opts.login).trim().toLowerCase(),
      senha: opts.senha,
    }),
  });
  if (!loginRes.ok) {
    const t = await loginRes.text();
    throw new Error(`Login falhou: ${loginRes.status} ${t.slice(0, 300)}`);
  }
  const json = await loginRes.json();
  if (!json.accessToken) throw new Error('Login sem accessToken');
  return json.accessToken;
}

async function fetchUsuariosApi(baseUrl, token) {
  const r = await fetch(`${baseUrl}/api/usuarios`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET /api/usuarios: ${r.status} ${t.slice(0, 300)}`);
  }
  return r.json();
}

function normalizarHoraComparar(h) {
  return normalizarHoraAgendaTxt(h);
}

function normalizarStatusComparar(s) {
  return normalizarStatusAgendaTxt(s);
}

async function fetchEventosDia(baseUrl, token, usuarioId, dataIso) {
  const q = new URLSearchParams({
    usuarioId: String(usuarioId),
    dataInicio: dataIso,
    dataFim: dataIso,
  });
  const r = await fetch(`${baseUrl}/api/agenda/eventos?${q}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET agenda ${usuarioId} ${dataIso}: ${r.status} ${t.slice(0, 200)}`);
  }
  return r.json();
}

/**
 * @param {object} txt
 * @param {object[]} eventosApi
 */
function encontrarCorrespondencia(txt, eventosApi) {
  const descTxt = descricaoComoNaApi(txt.descricao);
  const normDescTxt = normalizarStrAgenda(descTxt);
  const horaTxt = normalizarHoraComparar(txt.horaEvento);
  const statusTxt = normalizarStatusComparar(txt.statusCurto);

  /** @type {{ api: object, score: number }[]} */
  const candidatos = [];

  for (const api of eventosApi) {
    if (!compromissosEquivalentes(txt, api)) continue;

    const descApi = descricaoComoNaApi(api.descricao);
    const normDescApi = normalizarStrAgenda(descApi);
    let score = 100;
    if (normDescTxt === normDescApi) score += 20;
    else score += 10;

    const horaApi = normalizarHoraComparar(api.horaEvento);
    if (horaTxt === horaApi) score += 15;
    else if (!horaTxt || !horaApi) score += 10;

    const statusApi = normalizarStatusComparar(api.statusCurto);
    if (statusTxt === statusApi) score += 5;

    candidatos.push({ api, score });
  }

  if (candidatos.length === 0) return { tipo: 'faltando_na_api', api: null, candidatos: 0 };

  candidatos.sort((a, b) => b.score - a.score);
  const melhor = candidatos[0];
  const empate =
    candidatos.length > 1 &&
    candidatos[1].score === melhor.score &&
    melhor.score >= 100;

  if (empate) {
    return { tipo: 'ambiguo', api: null, candidatos: candidatos.length, topScore: melhor.score };
  }

  const api = melhor.api;
  const diffs = [];
  const descApi = descricaoComoNaApi(api.descricao);
  if (normalizarStrAgenda(descTxt) !== normalizarStrAgenda(descApi)) diffs.push('descricao');
  const horaTxtN = normalizarHoraComparar(txt.horaEvento);
  const horaApiN = normalizarHoraComparar(api.horaEvento);
  if (horaTxtN && horaApiN && horaTxtN !== horaApiN) diffs.push('hora');
  if (normalizarStatusComparar(txt.statusCurto) !== normalizarStatusComparar(api.statusCurto)) {
    diffs.push('status');
  }

  if (diffs.length === 0) {
    return { tipo: 'igual', api, candidatos: candidatos.length, diffs: [] };
  }
  if (diffs.length === 1 && diffs[0] === 'status') {
    return { tipo: 'igual', api, candidatos: candidatos.length, diffs, nota: 'status_pendente_vs_ok' };
  }
  return { tipo: 'atualizar', api, candidatos: candidatos.length, diffs };
}

async function validarAmostraComRelatorio(eventosEstruturados, opts, ctx) {
  const amostra = amostraAleatoria(eventosEstruturados, opts.validarAmostra, opts.seed);

  const { porDia: referenciaPorDia, ficheirosDia } = indexarReferenciaDiaLegado(opts.baseAgenda, {
    usuarios: opts.usuariosPasta,
    anoMin: opts.anoMin ?? undefined,
    anoMax: opts.anoMax ?? undefined,
    dataMin: opts.dataMin,
    dataMax: opts.dataMax,
  });

  const contagem = {
    pasta: { igual: 0, diferente: 0, dia_sem_referencia: 0, ambiguo: 0 },
    api: { igual: 0, atualizar: 0, faltando_na_api: 0, ambiguo: 0, erro_api: 0, sem_api: 0 },
    diffs: { descricao: 0, hora: 0, status: 0 },
  };

  console.log(
    `Referência na pasta: ${ficheirosDia} ficheiros dd.mm.yyyy.txt (${referenciaPorDia.size} dias)\n`
  );
  console.log(
    `=== Validação — ${amostra.length} eventos estruturados vs pasta (seed=${opts.seed}) ===\n`
  );

  let token = null;
  let apiErroLogin = null;
  let totalEventosApiAmostra = 0;
  /** @type {Map<string, object[]>} */
  const cacheDia = new Map();

  if (opts.senha && opts.validarApi !== false) {
    try {
      token = await loginObterToken(opts);
      const diasUnicos = [...new Set(amostra.map((e) => `${e.usuarioId}|${e.dataEvento}`))];
      let carregados = 0;
      for (let i = 0; i < diasUnicos.length; i += opts.concurrency) {
        const batch = diasUnicos.slice(i, i + opts.concurrency);
        await Promise.all(
          batch.map(async (chave) => {
            const [uid, data] = chave.split('|');
            const lista = await fetchEventosDia(opts.baseUrl, token, uid, data);
            const arr = Array.isArray(lista) ? lista : [];
            cacheDia.set(chave, arr);
            totalEventosApiAmostra += arr.length;
            carregados += 1;
          })
        );
      }
      console.log(
        `[api] ${cacheDia.size} dias consultados, ${totalEventosApiAmostra} compromissos na API\n`
      );
      if (totalEventosApiAmostra === 0) {
        console.warn('[api] Agenda vazia — comparação API ignorada no resumo principal.\n');
      }
    } catch (e) {
      apiErroLogin = String(e.message);
      console.warn(`[api] Sem comparação: ${e.message}\n`);
    }
  }

  /** @type {object[]} */
  const casos = [];
  const maxLog = Math.min(25, amostra.length);
  let logados = 0;

  for (let i = 0; i < amostra.length; i += 1) {
    const txt = amostra[i];
    const chaveDia = `${txt.usuarioId}|${txt.dataEvento}`;
    /** @type {object} */
    const caso = {
      n: i + 1,
      usuarioPasta: txt.usuarioPasta,
      usuarioId: txt.usuarioId,
      dataEvento: txt.dataEvento,
      linhaLegado: txt.linhaLegado,
      txt: {
        hora: txt.horaEvento,
        descricao: (txt.descricao ?? '').slice(0, 200),
        status: txt.statusCurto,
      },
      resultado: null,
      api: null,
    };

    const cmpPasta = compararEventoComReferenciaDia(txt, referenciaPorDia);
    caso.pasta = cmpPasta.tipo;
    contagem.pasta[cmpPasta.tipo] = (contagem.pasta[cmpPasta.tipo] ?? 0) + 1;

    if (token && totalEventosApiAmostra > 0) {
      try {
        const eventosApi = cacheDia.get(chaveDia) ?? [];
        const match = encontrarCorrespondencia(txt, eventosApi);
        caso.api = match.tipo;
        contagem.api[match.tipo] = (contagem.api[match.tipo] ?? 0) + 1;
        for (const d of match.diffs ?? []) {
          if (contagem.diffs[d] != null) contagem.diffs[d] += 1;
        }
      } catch (e) {
        contagem.api.erro_api += 1;
        caso.api = 'erro_api';
      }
    } else if (!token) {
      contagem.api.sem_api += 1;
    }

    const interessante =
      cmpPasta.tipo !== 'igual' && (logados < maxLog || cmpPasta.tipo === 'ambiguo');
    if (interessante) {
      logados += 1;
      console.log(
        `--- #${i + 1} [pasta:${cmpPasta.tipo}] ${txt.usuarioPasta} ${txt.dataEvento} L${txt.linhaLegado} ---`
      );
      console.log(`  estruturado: ${JSON.stringify(caso.txt)}`);
      if (cmpPasta.ref) {
        console.log(
          `  referência:  ${JSON.stringify({
            hora: cmpPasta.ref.horaEvento,
            descricao: String(cmpPasta.ref.descricao ?? '').slice(0, 120),
            status: cmpPasta.ref.statusCurto,
          })}`
        );
      } else if (cmpPasta.tipo === 'dia_sem_referencia') {
        console.log('  referência:  (sem ficheiro dd.mm.yyyy.txt neste dia)');
      }
      console.log('');
    }

    casos.push(caso);
  }

  const comparadosPasta =
    amostra.length - (contagem.pasta.dia_sem_referencia ?? 0);
  const pctPastaIgual =
    comparadosPasta > 0
      ? ((100 * (contagem.pasta.igual ?? 0)) / comparadosPasta).toFixed(1)
      : '—';

  console.log('=== Resumo vs pasta (dd.mm.yyyy.txt) ===');
  console.log(`  Igual:                ${contagem.pasta.igual ?? 0}  (${pctPastaIgual}% dos dias com referência)`);
  console.log(`  Diferente:            ${contagem.pasta.diferente ?? 0}`);
  console.log(`  Dia sem referência:   ${contagem.pasta.dia_sem_referencia ?? 0}  (só ficheiros .Agenda)`);
  console.log(`  Ambíguo:              ${contagem.pasta.ambiguo ?? 0}`);
  console.log('');

  if (totalEventosApiAmostra > 0) {
    const cmpApi = amostra.length - contagem.api.sem_api - contagem.api.erro_api;
    console.log('=== Resumo vs API ===');
    console.log(
      `  Igual: ${contagem.api.igual}  Atualizar: ${contagem.api.atualizar}  Faltando: ${contagem.api.faltando_na_api}`
    );
    console.log('');
  }

  const pctNum = Number(pctPastaIgual);
  const seguro =
    Number.isFinite(pctNum) &&
    pctNum >= 90 &&
    (contagem.pasta.ambiguo ?? 0) <= Math.ceil(amostra.length * 0.02);

  console.log(
    seguro
      ? 'Recomendação: ≥90% alinhado com ficheiros dia na pasta — script robusto para actualização.'
      : `Recomendação: apenas ${pctPastaIgual}% bate com dd.mm.yyyy.txt — rever parser ou referência.`
  );
  console.log('');

  return {
    geradoEm: new Date().toISOString(),
    modo: 'validar_amostra_estruturado_vs_pasta',
    seed: opts.seed,
    tamanhoAmostra: amostra.length,
    ficheirosDiaReferencia: ficheirosDia,
    diasComReferencia: referenciaPorDia.size,
    baseAgenda: opts.baseAgenda,
    baseUrl: opts.baseUrl,
    apiComparada: Boolean(token) && totalEventosApiAmostra > 0,
    apiErroLogin,
    totalEventosApiNosDiasAmostra: totalEventosApiAmostra,
    levantamentoTotal: ctx.totalLevantamento ?? null,
    contagem,
    percentuais: { pastaIgual: pctPastaIgual },
    recomendacao: {
      seguroParaAplicarAtualizacao: seguro,
      metaPercentualPasta: 90,
      alcancouMeta: seguro,
    },
    casos,
  };
}

function exportarXls(eventos, outPath) {
  const rows = [['data', 'dia', 'hora', 'compromisso', 'status', 'usuarioPasta', 'linhaLegado']];
  for (const e of eventos) {
    const [y, m, d] = e.dataEvento.split('-').map(Number);
    rows.push([
      e.dataEvento,
      d,
      e.horaEvento ?? '',
      e.descricao ?? '',
      e.statusCurto ?? '',
      e.usuarioPasta,
      e.linhaLegado,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Agenda');
  XLSX.writeFile(wb, outPath);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(opts.baseAgenda)) {
    console.error('Pasta Agenda não encontrada:', opts.baseAgenda);
    console.error('Defina VILAREAL_BANCO_DADOS_BASE ou --base-agenda=...');
    process.exit(1);
  }

  console.log('Base Agenda:', opts.baseAgenda);
  console.log('Utilizadores (pastas):', opts.usuariosPasta.join(', '));

  const levantamentoOpts = {
    usuarios: opts.usuariosPasta,
    anoMin: opts.anoMin ?? undefined,
    anoMax: opts.anoMax ?? undefined,
    dataMin: opts.dataMin,
    dataMax: opts.dataMax,
  };

  const t0 = Date.now();
  const {
    eventos,
    ficheirosIgnorados,
    ficheirosNomeInvalido,
    ficheirosDiaLegado,
    eventosSoDiaLegado,
    grupos,
  } = levantarEventosAgenda(opts.baseAgenda, levantamentoOpts);
  const ms = Date.now() - t0;

  const porPasta = {};
  const estruturados = eventos.filter((e) => e.fonte === 'estruturado');
  for (const e of eventos) {
    porPasta[e.usuarioPasta] = (porPasta[e.usuarioPasta] ?? 0) + 1;
  }

  console.log(
    `Eventos: ${eventos.length} total (${estruturados.length} estruturados + ${eventosSoDiaLegado} só dia-legado, ${grupos} slots, ${ms} ms)`
  );
  console.log(`Ficheiros dia-legado dd.mm.yyyy.txt: ${ficheirosDiaLegado}`);
  console.log('Por pasta:', porPasta);
  console.log(
    `Ficheiros ignorados (outros): ${ficheirosIgnorados}; datas inválidas: ${ficheirosNomeInvalido}`
  );

  if (opts.exportarXls) {
    const abs = path.resolve(opts.exportarXls);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    exportarXls(eventos, abs);
    console.log('Planilha exportada:', abs);
  }

  const relatorio = {
    baseAgenda: opts.baseAgenda,
    usuariosPasta: opts.usuariosPasta,
    eventos: eventos.length,
    grupos,
    porPasta,
    ficheirosIgnorados,
    ficheirosNomeInvalido,
    msLevantamento: ms,
    filtros: levantamentoOpts,
  };

  let usuarioPorChave = null;
  let eventosComId = null;

  if (opts.validarAmostra != null || opts.aplicar) {
    if (!opts.senha) {
      console.error('Validação/aplicar requer VILAREAL_IMPORT_SENHA ou --senha=');
      process.exit(1);
    }
    const tokenMapa = await loginObterToken(opts);
    const listaUsuarios = await fetchUsuariosApi(opts.baseUrl, tokenMapa);
    const built = construirMapaUsuariosPorChave(listaUsuarios);
    usuarioPorChave = built.map;
    if (built.conflitos.length) {
      console.warn('[warn] Conflitos no mapa de utilizadores:', built.conflitos.slice(0, 5));
    }
    const semUsuario = [];
    eventosComId = [];
    const baseEventos = opts.validarAmostra != null ? estruturados : eventos;
    for (const e of baseEventos) {
      const usuarioId = resolverUsuarioIdPasta(e.usuarioPasta, usuarioPorChave);
      if (usuarioId == null) {
        semUsuario.push(e.usuarioPasta);
        continue;
      }
      eventosComId.push({ ...e, usuarioId });
    }
    if (semUsuario.length) {
      const unicos = [...new Set(semUsuario)];
      console.error('Pastas sem utilizador na API:', unicos.join(', '));
      process.exit(1);
    }
  }

  if (opts.validarAmostra != null) {
    const relValidacao = await validarAmostraComRelatorio(eventosComId, opts, {
      totalLevantamento: relatorio,
    });
    const outRel = opts.relatorio || 'tmp/relatorio-validar-agenda-txt-amostra.json';
    const abs = path.resolve(outRel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(relValidacao, null, 2), 'utf8');
    console.log('Relatório completo:', abs);
    process.exit(relValidacao.recomendacao?.seguroParaAplicarAtualizacao ? 0 : 1);
  }

  if (opts.relatorio && !opts.aplicar) {
    const abs = path.resolve(opts.relatorio);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(relatorio, null, 2), 'utf8');
    console.log('Relatório:', abs);
  }

  if (opts.dryRun) {
    for (const e of eventos.slice(0, 12)) {
      console.log(JSON.stringify(e));
    }
    if (eventos.length > 12) console.log(`… e mais ${eventos.length - 12}`);
    process.exit(0);
  }

  const token = await loginObterToken(opts);

  const linhas = [];
  let puladosDupTxt = 0;
  let puladosSemConteudo = 0;

  for (const e of eventosComId) {
    if (!eventoImportavel(e)) {
      puladosSemConteudo += 1;
      continue;
    }
    if (
      linhas.some(
        (L) =>
          L.usuarioId === e.usuarioId &&
          L.dataEvento === e.dataEvento &&
          compromissosEquivalentes(e, L)
      )
    ) {
      puladosDupTxt += 1;
      continue;
    }
    linhas.push(e);
  }

  console.log(
    `Importação: ${linhas.length} eventos únicos (${puladosDupTxt} dup txt, ${puladosSemConteudo} só status sem texto, concurrency=${opts.concurrency})`
  );
  console.log(`API: ${opts.baseUrl}\n`);

  const origem = 'import-txt-agenda-local';
  let criados = 0;
  let puts = 0;
  let fail = 0;
  let puladosIgual = 0;
  let puladosAmbiguo = 0;

  /** @type {Map<string, object[]>} */
  const cacheDia = new Map();

  async function aplicarUm(L) {
    const chaveDia = `${L.usuarioId}|${L.dataEvento}`;
    if (!cacheDia.has(chaveDia)) {
      const lista = await fetchEventosDia(opts.baseUrl, token, L.usuarioId, L.dataEvento);
      cacheDia.set(chaveDia, Array.isArray(lista) ? lista : []);
    }
    const listaDia = cacheDia.get(chaveDia) ?? [];
    const match = encontrarCorrespondencia(L, listaDia);

    if (match.tipo === 'igual') {
      puladosIgual += 1;
      return 'skip';
    }
    if (match.tipo === 'ambiguo') {
      puladosAmbiguo += 1;
      return 'skip';
    }

    if (match.tipo === 'atualizar' && match.api?.id) {
      const body = buildBodyAgenda(L, origem, match.api.processoRef ?? null);
      const r = await fetch(`${opts.baseUrl}/api/agenda/eventos/${match.api.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error(
          `Erro PUT ${L.usuarioPasta} ${L.dataEvento} id=${match.api.id}:`,
          r.status,
          t.slice(0, 200)
        );
        return false;
      }
      const atualizado = await r.json();
      const idx = listaDia.findIndex((x) => x.id === match.api.id);
      if (idx >= 0) listaDia[idx] = atualizado;
      puts += 1;
      return true;
    }

    if (match.tipo === 'faltando_na_api') {
      const dupApi = listaDia.some((api) => compromissosEquivalentes(L, api));
      if (dupApi) {
        puladosIgual += 1;
        return 'skip';
      }

      const body = buildBodyAgenda(L, origem, null);
      const r = await fetch(`${opts.baseUrl}/api/agenda/eventos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error(
          `Erro POST ${L.usuarioPasta} ${L.dataEvento} L${L.linhaLegado}:`,
          r.status,
          t.slice(0, 200)
        );
        return false;
      }
      const criado = await r.json();
      listaDia.push(criado);
      criados += 1;
      return true;
    }

    return false;
  }

  for (let i = 0; i < linhas.length; i += opts.concurrency) {
    const batch = linhas.slice(i, i + opts.concurrency);
    const results = await Promise.all(batch.map((L) => aplicarUm(L)));
    for (const rr of results) {
      if (rr === true) continue;
      if (rr === 'skip') continue;
      fail += 1;
    }
    const done = Math.min(i + opts.concurrency, linhas.length);
    if (linhas.length > 500 && (done % 2000 < opts.concurrency || done === linhas.length)) {
      console.log(`… ${done}/${linhas.length}`);
    }
  }

  relatorio.aplicar = {
    criados,
    puts,
    fail,
    puladosDupTxt,
    puladosSemConteudo,
    puladosIgual,
    puladosAmbiguo,
    enviadosUnicos: linhas.length,
  };
  const absRel = opts.relatorio || 'tmp/relatorio-import-agenda-txt.json';
  fs.mkdirSync(path.dirname(path.resolve(absRel)), { recursive: true });
  fs.writeFileSync(path.resolve(absRel), JSON.stringify(relatorio, null, 2), 'utf8');

  console.log(
    `Concluído: ${criados} criados, ${puts} actualizados, ${fail} falhas | dup txt=${puladosDupTxt} iguais/ambíguos=${puladosIgual + puladosAmbiguo} sem texto=${puladosSemConteudo}`
  );
  console.log('Relatório:', path.resolve(absRel));
  process.exit(fail > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
