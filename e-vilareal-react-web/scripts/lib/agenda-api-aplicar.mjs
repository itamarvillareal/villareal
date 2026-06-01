/**
 * POST/PUT de eventos de agenda na API — partilhado por import e sync incremental.
 */

import {
  compromissosEquivalentes,
  compromissosEquivalentesAgenda,
  descricaoComoNaApi,
  normalizarHoraAgendaTxt,
  normalizarStatusAgendaTxt,
  normalizarStrAgenda,
  temDescricaoUtil,
  chaveConteudoEvento,
} from './agenda-local-txt.mjs';

export const ORIGEM_AGENDA_TXT = 'import-txt-agenda-local';

export const ALIASES_PASTA_AGENDA = {
  'Dr. Itamar': ['dr itamar', 'dr. itamar', 'itamar', 'dr itamar villareal'],
  KARLA: ['karla', 'karla pedroza'],
  'Ana Luisa': ['ana luisa', 'ana luísa', 'ana.luisa'],
};

export function normChave(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function construirMapaUsuariosPorChave(usuarios) {
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

export function resolverUsuarioIdPasta(usuarioPasta, mapa) {
  const aliases = [usuarioPasta, ...(ALIASES_PASTA_AGENDA[usuarioPasta] ?? [])];
  for (const a of aliases) {
    const id = mapa.get(normChave(a));
    if (id != null) return id;
  }
  return null;
}

export function eventoImportavel(ev) {
  if (temDescricaoUtil(ev.descricao)) return true;
  if (normalizarHoraAgendaTxt(ev.horaEvento)) return true;
  return false;
}

export function chaveDedupImport(usuarioId, ev) {
  return `${usuarioId}|${ev.dataEvento}|${chaveConteudoEvento(ev)}`;
}

/**
 * Evita duplicar no mesmo lote txt eventos equivalentes (descrição/hora flexível).
 * @param {object[]} linhas
 * @param {object} ev
 */
export function jaTemEquivalenteNoLote(linhas, ev) {
  return linhas.some(
    (L) =>
      L.usuarioId === ev.usuarioId &&
      L.dataEvento === ev.dataEvento &&
      compromissosEquivalentesAgenda(ev, L)
  );
}

export function buildBodyAgenda(L, origem, processoRef = null) {
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

export async function loginObterToken(opts) {
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

export async function fetchUsuariosApi(baseUrl, token) {
  const r = await fetch(`${baseUrl}/api/usuarios`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET /api/usuarios: ${r.status} ${t.slice(0, 300)}`);
  }
  return r.json();
}

export async function fetchEventosDia(baseUrl, token, usuarioId, dataIso) {
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
export function encontrarCorrespondencia(txt, eventosApi) {
  const descTxt = descricaoComoNaApi(txt.descricao);
  const normDescTxt = normalizarStrAgenda(descTxt);
  const horaTxt = normalizarHoraAgendaTxt(txt.horaEvento);
  const statusTxt = normalizarStatusAgendaTxt(txt.statusCurto);

  /** @type {{ api: object, score: number }[]} */
  const candidatos = [];

  for (const api of eventosApi) {
    if (!compromissosEquivalentesAgenda(txt, api)) continue;

    const descApi = descricaoComoNaApi(api.descricao);
    const normDescApi = normalizarStrAgenda(descApi);
    let score = 100;
    if (normDescTxt === normDescApi) score += 20;
    else score += 10;

    const horaApi = normalizarHoraAgendaTxt(api.horaEvento);
    if (horaTxt === horaApi) score += 15;
    else if (!horaTxt || !horaApi) score += 10;

    const statusApi = normalizarStatusAgendaTxt(api.statusCurto);
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
  const horaTxtN = normalizarHoraAgendaTxt(txt.horaEvento);
  const horaApiN = normalizarHoraAgendaTxt(api.horaEvento);
  if (horaTxtN && horaApiN && horaTxtN !== horaApiN) diffs.push('hora');
  if (normalizarStatusAgendaTxt(txt.statusCurto) !== normalizarStatusAgendaTxt(api.statusCurto)) {
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

/**
 * @param {object} opts — baseUrl, concurrency, origem?
 * @param {object[]} linhas — eventos com usuarioId
 * @param {string} token
 * @param {boolean} aplicar — false = dry-run
 * @param {boolean} [verbose]
 */
export async function aplicarEventosAgenda(opts, linhas, token, aplicar, verbose = false) {
  const origem = opts.origem ?? ORIGEM_AGENDA_TXT;
  const stats = {
    criados: 0,
    puts: 0,
    fail: 0,
    puladosIgual: 0,
    puladosAmbiguo: 0,
    dryRunCriar: 0,
    dryRunAtualizar: 0,
  };

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
      stats.puladosIgual += 1;
      return 'skip';
    }
    if (match.tipo === 'ambiguo') {
      stats.puladosAmbiguo += 1;
      return 'skip';
    }

    if (match.tipo === 'atualizar' && match.api?.id) {
      if (!aplicar) {
        stats.dryRunAtualizar += 1;
        if (verbose) {
          console.log(
            `  [dry-run PUT] ${L.usuarioPasta} ${L.dataEvento} L${L.linhaLegado} id=${match.api.id} (${(match.diffs ?? []).join(',')}) | ${descricaoComoNaApi(L.descricao).slice(0, 60)}`
          );
        }
        return 'dry-put';
      }
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
          `Erro PUT ${L.usuarioPasta} ${L.dataEvento} L${L.linhaLegado} id=${match.api.id}:`,
          r.status,
          t.slice(0, 200)
        );
        return false;
      }
      const atualizado = await r.json();
      const idx = listaDia.findIndex((x) => x.id === match.api.id);
      if (idx >= 0) listaDia[idx] = atualizado;
      stats.puts += 1;
      if (verbose) {
        console.log(
          `  [actualizado] ${L.usuarioPasta} ${L.dataEvento} L${L.linhaLegado} id=${match.api.id} | ${descricaoComoNaApi(L.descricao).slice(0, 60)}`
        );
      }
      return true;
    }

    if (match.tipo === 'faltando_na_api') {
      const dupApi = listaDia.some((api) => compromissosEquivalentesAgenda(L, api));
      if (dupApi) {
        stats.puladosIgual += 1;
        return 'skip';
      }
      if (!aplicar) {
        stats.dryRunCriar += 1;
        if (verbose) {
          console.log(
            `  [dry-run POST] ${L.usuarioPasta} ${L.dataEvento} L${L.linhaLegado} | ${descricaoComoNaApi(L.descricao).slice(0, 70)}`
          );
        }
        return 'dry-post';
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
      stats.criados += 1;
      if (verbose) {
        console.log(
          `  [criado] ${L.usuarioPasta} ${L.dataEvento} L${L.linhaLegado} id=${criado.id} | ${descricaoComoNaApi(L.descricao).slice(0, 60)}`
        );
      }
      return true;
    }

    return false;
  }

  const concurrency = opts.concurrency ?? 8;
  for (let i = 0; i < linhas.length; i += concurrency) {
    const batch = linhas.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((L) => aplicarUm(L)));
    for (const rr of results) {
      if (rr === true || rr === 'skip' || rr === 'dry-post' || rr === 'dry-put') continue;
      stats.fail += 1;
    }
  }

  return stats;
}
