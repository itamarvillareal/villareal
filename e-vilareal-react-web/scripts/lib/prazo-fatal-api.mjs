/**
 * Gravação de prazo fatal na API (processo + entidade processo_prazo).
 */

import { corpoPutProcesso } from './import-processo-put-body.mjs';

/**
 * @param {string} baseUrl
 * @param {string} login
 * @param {string} senha
 */
export async function loginImportApi(baseUrl, login, senha) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: String(login).trim().toLowerCase(), senha }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Login falhou ${res.status}: ${t.slice(0, 400)}`);
  }
  const json = await res.json();
  if (!json.accessToken) throw new Error('Login sem accessToken');
  return json.accessToken;
}

/** @param {unknown} val */
export function normalizarDataApi(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : null;
}

/** @param {object} p @param {string} prazoFatalIso */
export function corpoPutProcessoComPrazoFatal(p, prazoFatalIso) {
  return corpoPutProcesso(p, { prazoFatal: prazoFatalIso });
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} processoId
 * @param {string} dataFimIso yyyy-mm-dd
 */
export async function upsertPrazoFatalEntidade(baseUrl, token, processoId, dataFimIso) {
  const listUrl = `${baseUrl}/api/processos/${processoId}/prazos`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!listRes.ok) {
    const t = await listRes.text();
    throw new Error(`GET prazos ${processoId}: ${listRes.status} ${t.slice(0, 200)}`);
  }
  const prazos = await listRes.json();
  const existente = Array.isArray(prazos) ? prazos.find((z) => z.prazoFatal === true) : null;

  const body = {
    andamentoId: null,
    descricao: 'Prazo fatal do processo',
    dataInicio: null,
    dataFim: dataFimIso,
    prazoFatal: true,
    status: existente?.status || 'PENDENTE',
    observacao: null,
  };

  if (existente?.id) {
    const res = await fetch(`${listUrl}/${existente.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`PUT prazo ${existente.id}: ${res.status} ${t.slice(0, 200)}`);
    }
    return 'put';
  }

  const res = await fetch(listUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`POST prazo: ${res.status} ${t.slice(0, 200)}`);
  }
  return 'post';
}

/**
 * Alinha API ao txt 145.1: coluna processo.prazo_fatal + registo processo_prazo fatal.
 *
 * @param {string} baseUrl
 * @param {string} token
 * @param {object} proc
 * @param {string} prazoFatalIso yyyy-mm-dd
 */
export async function aplicarPrazoFatalNaApi(baseUrl, token, proc, prazoFatalIso) {
  const putBody = corpoPutProcessoComPrazoFatal(proc, prazoFatalIso);
  const res = await fetch(`${baseUrl}/api/processos/${proc.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(putBody),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PUT processo ${proc.id}: ${res.status} ${t.slice(0, 200)}`);
  }
  await upsertPrazoFatalEntidade(baseUrl, token, proc.id, prazoFatalIso);
}
