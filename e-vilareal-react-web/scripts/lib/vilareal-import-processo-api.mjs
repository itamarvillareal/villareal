/**
 * Helpers HTTP partilhados por scripts de importação (processo por cod8 + nº interno).
 */

/**
 * @param {unknown} body
 * @param {number} numeroInternoAlvo
 */
export function extrairProcessoUnico(body, numeroInternoAlvo) {
  const ni = Math.trunc(Number(numeroInternoAlvo));
  if (body == null || typeof body !== 'object') return null;
  if (Array.isArray(body)) {
    return body.find((p) => Number(p?.numeroInterno) === ni) ?? null;
  }
  if (Array.isArray(body.content)) {
    return body.content.find((p) => Number(p?.numeroInterno) === ni) ?? null;
  }
  if (body.id != null) {
    const niResp = Number(body.numeroInterno);
    return !Number.isFinite(niResp) || niResp === ni ? body : null;
  }
  return null;
}

function processoDoCliente(proc, cod8, pessoaId) {
  if (!proc?.id) return false;
  const codResp = String(proc.codigoCliente ?? '')
    .replace(/\D/g, '')
    .padStart(8, '0');
  const codAlvo = String(cod8 ?? '')
    .replace(/\D/g, '')
    .padStart(8, '0');
  if (codResp === codAlvo) return true;
  if (pessoaId != null && Number(proc.clienteId ?? proc.pessoaId) === Number(pessoaId)) {
    return true;
  }
  return false;
}

/**
 * @param {Map<string, number>} [pessoaPorCod8]
 */
export async function buscarProcesso(baseUrl, token, cod8, numeroInterno, pessoaPorCod8 = new Map()) {
  const ni = Math.trunc(Number(numeroInterno));
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  const urlDireto = `${baseUrl}/api/processos?${new URLSearchParams({
    codigoCliente: cod8,
    numeroInterno: String(ni),
  })}`;
  const resDireto = await fetch(urlDireto, { headers });
  if (resDireto.status === 404) return null;
  if (resDireto.ok) {
    const json = await resDireto.json();
    const hit = extrairProcessoUnico(json, ni);
    if (hit?.id) return hit;
  } else if (resDireto.status !== 404) {
    const t = await resDireto.text();
    throw new Error(`GET processo ${cod8}/${ni}: ${resDireto.status} ${t.slice(0, 200)}`);
  }

  const pessoaId =
    pessoaPorCod8.get(cod8) ?? (await resolverPessoaIdCliente(baseUrl, token, cod8, pessoaPorCod8));

  for (let page = 0; page < 50; page += 1) {
    const url = `${baseUrl}/api/processos?${new URLSearchParams({
      codigoCliente: cod8,
      page: String(page),
      size: '100',
    })}`;
    const res = await fetch(url, { headers });
    if (!res.ok) break;
    const json = await res.json();
    const hit = extrairProcessoUnico(json, ni);
    if (hit?.id) return hit;
    if (json?.last === true || !json?.content?.length) break;
  }

  const urlPorNi = `${baseUrl}/api/processos/por-numero-interno?${new URLSearchParams({
    numeroInterno: String(ni),
  })}`;
  const resNi = await fetch(urlPorNi, { headers });
  if (resNi.ok) {
    const lista = await resNi.json();
    if (Array.isArray(lista)) {
      const hit = lista.find((p) => processoDoCliente(p, cod8, pessoaId));
      if (hit?.id) return hit;
    }
  }

  return null;
}

/**
 * @param {Map<string, number>} cache
 */
export async function resolverPessoaIdCliente(baseUrl, token, cod8, cache) {
  if (cache.has(cod8)) return cache.get(cod8);
  const url = `${baseUrl}/api/clientes/resolucao?${new URLSearchParams({ codigoCliente: cod8 })}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const j = await res.json();
  const pid = Number(j.pessoaId ?? j.id);
  if (!Number.isFinite(pid) || pid < 1) return null;
  cache.set(cod8, pid);
  return pid;
}

const DESCRICAO_STUB_IMPORT =
  'Processo criado automaticamente antes do import-real (cabecalho ausente na API).';

/**
 * POST stub mínimo em /api/processos.
 * @param {string} [descricaoAcao]
 */
export async function criarProcessoStubImport(
  baseUrl,
  token,
  pessoaId,
  numeroInterno,
  descricaoAcao = DESCRICAO_STUB_IMPORT
) {
  const body = {
    clienteId: pessoaId,
    numeroInterno: Math.trunc(Number(numeroInterno)),
    ativo: true,
    consultaAutomatica: false,
    descricaoAcao,
  };
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/processos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (res.status === 201 || res.status === 200) return { ok: true };
  if (res.status === 422 && /j[aá]\s*existe/i.test(txt)) return { ok: true, duplicate: true };
  return { ok: false, status: res.status, text: txt.slice(0, 300) };
}

/**
 * Garante registo do processo na API; cria stub se ainda não existir.
 * @param {Map<string, number>} [pessoaPorCod8]
 * @returns {Promise<{ ok: boolean, criado: boolean, processo: object | null, erro?: string }>}
 */
export async function garantirProcessoNaApi(
  baseUrl,
  token,
  cod8,
  numeroInterno,
  pessoaPorCod8 = new Map()
) {
  const ni = Math.trunc(Number(numeroInterno));
  let proc = await buscarProcesso(baseUrl, token, cod8, ni, pessoaPorCod8);
  if (proc?.id) return { ok: true, criado: false, processo: proc };

  const pessoaId = await resolverPessoaIdCliente(baseUrl, token, cod8, pessoaPorCod8);
  if (!pessoaId) {
    return { ok: false, criado: false, processo: null, erro: 'pessoa do cliente não resolvida na API' };
  }

  const r = await criarProcessoStubImport(baseUrl, token, pessoaId, ni);
  if (!r.ok) {
    return {
      ok: false,
      criado: false,
      processo: null,
      erro: `POST processo falhou ${r.status ?? '?'}: ${r.text ?? ''}`,
    };
  }

  proc = await buscarProcesso(baseUrl, token, cod8, ni, pessoaPorCod8);
  if (!proc?.id) {
    return { ok: false, criado: true, processo: null, erro: 'stub criado mas processo não encontrado após POST' };
  }
  return { ok: true, criado: true, processo: proc };
}

export async function loginImportApi(baseUrl, login, senha) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: String(login).trim().toLowerCase(),
      senha,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Login falhou ${res.status}: ${t.slice(0, 400)}`);
  }
  const json = await res.json();
  if (!json.accessToken) throw new Error('Login sem accessToken');
  return json.accessToken;
}
