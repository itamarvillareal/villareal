const DEFAULT_PORT = 9876;
const DEFAULT_HOST = '127.0.0.1';

function baseUrl() {
  const port = Number(import.meta.env?.VITE_LOCAL_HELPER_PORT || DEFAULT_PORT);
  const host = String(import.meta.env?.VITE_LOCAL_HELPER_HOST || DEFAULT_HOST).trim() || DEFAULT_HOST;
  return `http://${host}:${port}`;
}

async function chamarLocalHelper(caminho, body) {
  const res = await fetch(`${baseUrl()}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
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

/** Verifica se o agente local está ativo. */
export async function verificarLocalHelperAtivo() {
  try {
    const res = await fetch(`${baseUrl()}/health`, { method: 'GET' });
    if (!res.ok) return { ativo: false, baseClientes: null };
    const data = await res.json();
    return { ativo: Boolean(data?.ok), baseClientes: data?.baseClientes ?? null };
  } catch {
    return { ativo: false, baseClientes: null };
  }
}

/**
 * Abre a pasta do cliente (e subpasta Proc. NN se existir) no Finder/Explorer via agente local.
 * @param {{ codigoCliente: string, nomeCliente?: string, numeroInterno?: number|null, abrirPastaProcesso?: boolean }} params
 */
export async function abrirPastaClienteLocal({
  codigoCliente,
  nomeCliente,
  numeroInterno = null,
  abrirPastaProcesso = true,
}) {
  const cod = String(codigoCliente ?? '').trim();
  if (!cod) throw new Error('Informe o código do cliente.');

  const body = {
    codigoCliente: cod,
    nomeCliente: String(nomeCliente ?? '').trim() || undefined,
  };
  if (abrirPastaProcesso && numeroInterno != null && String(numeroInterno).trim() !== '') {
    body.numeroInterno = Number(numeroInterno);
  }

  return chamarLocalHelper('/abrir-pasta-cliente', body);
}

export class LocalHelperIndisponivelError extends Error {
  constructor(message = 'Agente local não está em execução.') {
    super(message);
    this.name = 'LocalHelperIndisponivelError';
  }
}

/** Tenta abrir via agente; se falhar por conexão, lança LocalHelperIndisponivelError. */
export async function abrirPastaClienteLocalOuFalhar(params) {
  try {
    return await abrirPastaClienteLocal(params);
  } catch (err) {
    if (err instanceof TypeError || /fetch|network|Failed/i.test(String(err?.message ?? ''))) {
      throw new LocalHelperIndisponivelError();
    }
    throw err;
  }
}
