const DEFAULT_PORT = 9876;
const HOSTS_TENTATIVA = ['127.0.0.1', 'localhost'];
const TIMEOUT_MS = 5000;

function portas() {
  const port = Number(import.meta.env?.VITE_LOCAL_HELPER_PORT || DEFAULT_PORT);
  return Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT;
}

function urlsBase() {
  const port = portas();
  const envHost = String(import.meta.env?.VITE_LOCAL_HELPER_HOST || '').trim();
  if (envHost) return [`http://${envHost}:${port}`];
  return HOSTS_TENTATIVA.map((host) => `http://${host}:${port}`);
}

function fetchOpcoes(method = 'GET', body, { loopback = true } = {}) {
  const init = {
    method,
    mode: 'cors',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  };
  if (loopback) {
    init.targetAddressSpace = 'loopback';
  }
  if (body != null) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return init;
}

async function tentarFetch(url, init) {
  const variantes = [init];
  if (init.targetAddressSpace) {
    const { targetAddressSpace, ...plain } = init;
    variantes.push(plain);
  }

  let ultimoErro = null;
  for (const opcao of variantes) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, { ...opcao, signal: controller.signal });
    } catch (err) {
      ultimoErro = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw ultimoErro ?? new Error('Agente local indisponível');
}

function isErroRede(err) {
  return err instanceof TypeError || /fetch|network|Failed|abort/i.test(String(err?.message ?? ''));
}

async function chamarEmAlgumHost(caminho, init) {
  let ultimoErro = null;
  for (const base of urlsBase()) {
    try {
      const res = await tentarFetch(`${base}${caminho}`, init);
      return { res, base };
    } catch (err) {
      ultimoErro = err;
    }
  }
  throw ultimoErro ?? new Error('Agente local indisponível');
}

async function parseRespostaLocalHelper(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data?.erro || `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function chamarLocalHelperPost(caminho, body) {
  const { res } = await chamarEmAlgumHost(caminho, fetchOpcoes('POST', body));
  return parseRespostaLocalHelper(res);
}

async function chamarLocalHelperGet(caminho) {
  const { res } = await chamarEmAlgumHost(caminho, fetchOpcoes('GET'));
  return parseRespostaLocalHelper(res);
}

/** Verifica se o agente local está ativo. */
export async function verificarLocalHelperAtivo() {
  for (const base of urlsBase()) {
    try {
      const res = await tentarFetch(`${base}/health`, fetchOpcoes('GET'));
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.ok) {
        return { ativo: true, baseClientes: data?.baseClientes ?? null, baseUrl: base };
      }
    } catch {
      /* tenta próximo host */
    }
  }
  return { ativo: false, baseClientes: null, baseUrl: null };
}

function montarQueryAbrirPasta({ codigoCliente, nomeCliente, numeroInterno, abrirPastaProcesso = true }) {
  const params = new URLSearchParams();
  params.set('codigoCliente', String(codigoCliente ?? '').trim());
  const nome = String(nomeCliente ?? '').trim();
  if (nome) params.set('nomeCliente', nome);
  if (abrirPastaProcesso && numeroInterno != null && String(numeroInterno).trim() !== '') {
    params.set('numeroInterno', String(Number(numeroInterno)));
  }
  return params.toString();
}

function montarBodyAbrirPasta({ codigoCliente, nomeCliente, numeroInterno, abrirPastaProcesso = true }) {
  const cod = String(codigoCliente ?? '').trim();
  const body = {
    codigoCliente: cod,
    nomeCliente: String(nomeCliente ?? '').trim() || undefined,
  };
  if (abrirPastaProcesso && numeroInterno != null && String(numeroInterno).trim() !== '') {
    body.numeroInterno = Number(numeroInterno);
  }
  return body;
}

/**
 * Fallback: abre URL GET no navegador (dispara permissão de rede local no Chrome e abre o Finder).
 * Usado quando fetch CORS/PNA falha mesmo com o agente ativo em localhost:9876.
 */
export function abrirPastaClienteViaNavegador(params) {
  const query = montarQueryAbrirPasta(params);
  const url = `${urlsBase()[0]}/abrir-pasta-cliente?${query}`;
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) {
    window.location.assign(url);
  }
  return { ok: true, viaNavegador: true };
}

/**
 * Abre a pasta do cliente (e subpasta Proc. NN se existir) no Finder/Explorer via agente local.
 */
export async function abrirPastaClienteLocal({
  codigoCliente,
  nomeCliente,
  numeroInterno = null,
  abrirPastaProcesso = true,
}) {
  const cod = String(codigoCliente ?? '').trim();
  if (!cod) throw new Error('Informe o código do cliente.');

  const params = { codigoCliente: cod, nomeCliente, numeroInterno, abrirPastaProcesso };
  const body = montarBodyAbrirPasta(params);

  try {
    return await chamarLocalHelperPost('/abrir-pasta-cliente', body);
  } catch (err) {
    if (!isErroRede(err)) throw err;
    try {
      const query = montarQueryAbrirPasta(params);
      return await chamarLocalHelperGet(`/abrir-pasta-cliente?${query}`);
    } catch (errGet) {
      if (!isErroRede(errGet)) throw errGet;
      return abrirPastaClienteViaNavegador(params);
    }
  }
}

export class LocalHelperIndisponivelError extends Error {
  constructor(message = 'Agente local não está em execução.') {
    super(message);
    this.name = 'LocalHelperIndisponivelError';
  }
}

/** Abre pasta no Finder/Explorer; mantém o portal aberto quando possível. */
export async function abrirPastaClienteLocalOuFalhar(params) {
  try {
    return await abrirPastaClienteLocal(params);
  } catch (err) {
    if (isErroRede(err)) {
      throw new LocalHelperIndisponivelError();
    }
    throw err;
  }
}
