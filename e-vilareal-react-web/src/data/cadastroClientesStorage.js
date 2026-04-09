/**
 * Persistência local dos dados editáveis do Cadastro de Clientes (por código de cliente).
 */


export const STORAGE_CADASTRO_CLIENTES_DADOS = 'vilareal:cadastro-clientes-dados:v1';

/** Último código de cliente aberto no Cadastro de Clientes (restaura ao voltar à tela). */
export const STORAGE_ULTIMO_COD_CLIENTE = 'vilareal:cadastro-clientes-ultimo-cod:v1';

/** @returns {string|null} código com 8 dígitos ou null */
export function loadUltimoCodigoCliente() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_ULTIMO_COD_CLIENTE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return padCliente8Cadastro(parsed);
    if (parsed && typeof parsed.codigo === 'string') return padCliente8Cadastro(parsed.codigo);
    return null;
  } catch {
    return null;
  }
}

export function padCliente8Cadastro(val) {
  const s = String(val ?? '').replace(/\D/g, '');
  const n = s ? Number(s) : 1;
  if (!Number.isFinite(n) || n < 1) return '00000001';
  return String(Math.floor(n)).padStart(8, '0');
}

/** Maior código numérico já referenciado nas chaves persistidas (e opcionalmente na lista da API). */
export function obterMaiorCodigoClienteConhecido() {
  let max = 0;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_CADASTRO_CLIENTES_DADOS);
      if (!raw) return max;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return max;
      for (const key of Object.keys(parsed)) {
        const n = Number(String(key).replace(/\D/g, ''));
        if (Number.isFinite(n) && n > max) max = n;
      }
    } catch {
      /* ignore */
    }
  }
  return max;
}

/** Próximo código sugerido (maior conhecido + 1), 8 dígitos. */
export function obterProximoCodigoClienteSugerido() {
  return padCliente8Cadastro(obterMaiorCodigoClienteConhecido() + 1);
}

/**
 * Códigos de cliente conhecidos (API + persistência local + mapa mock), ordenados numericamente.
 * @param {Array<{ codigo?: string, pessoa?: string }>|null|undefined} clientesApiFront
 */
export function coletarCodigosClienteConhecidos(clientesApiFront) {
  const s = new Set();
  if (Array.isArray(clientesApiFront)) {
    for (const c of clientesApiFront) {
      if (c?.codigo != null && String(c.codigo).trim() !== '') {
        s.add(padCliente8Cadastro(c.codigo));
      }
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_CADASTRO_CLIENTES_DADOS);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') {
        for (const k of Object.keys(parsed)) {
          s.add(padCliente8Cadastro(k));
        }
      }
    } catch {
      /* ignore */
    }
  }
  return [...s].sort((a, b) => {
    const na = Number(String(a).replace(/\D/g, '')) || 0;
    const nb = Number(String(b).replace(/\D/g, '')) || 0;
    return na - nb;
  });
}

/**
 * Há vínculo no campo Pessoa (id numérico ≥ 1). Com linha na API, só o valor da API conta.
 */
export function clienteTemPessoaAtribuida(codPadded8, clientesApiFront) {
  const cod = padCliente8Cadastro(codPadded8);
  const apiRow = Array.isArray(clientesApiFront) ? clientesApiFront.find((c) => c.codigo === cod) : null;
  if (apiRow != null) {
    const raw = String(apiRow.pessoa ?? '').trim();
    if (!raw) return false;
    const n = Number(raw.replace(/\D/g, ''));
    return Number.isFinite(n) && n >= 1;
  }
  const persisted = loadCadastroClienteDados(cod);
  if (persisted) {
    const raw = String(persisted.pessoa ?? '').trim();
    if (!raw) return false;
    const n = Number(raw.replace(/\D/g, ''));
    return Number.isFinite(n) && n >= 1;
  }
  return false;
}

/**
 * Menor código de cliente conhecido ainda sem Pessoa; se todos tiverem, o próximo número livre após o maior código conhecido.
 * O cliente em edição usa o valor atual do campo Pessoa (mesmo antes de salvar na API).
 *
 * @param {Array<{ codigo?: string, pessoa?: string }>|null|undefined} clientesApiFront — ex.: `clientesApiIndex` quando `useApiClientes`; senão `[]`.
 * @param {string|undefined} codigoEmEdicaoPadded — código aberto no formulário (8 dígitos).
 * @param {string|undefined} pessoaCampoAtual — valor do input Pessoa desse formulário.
 */
export function obterProximoCodigoClienteSemPessoaAtribuida(
  clientesApiFront,
  codigoEmEdicaoPadded,
  pessoaCampoAtual
) {
  const codes = coletarCodigosClienteConhecidos(clientesApiFront);
  const codEd =
    codigoEmEdicaoPadded != null && String(codigoEmEdicaoPadded).trim() !== ''
      ? padCliente8Cadastro(codigoEmEdicaoPadded)
      : null;

  function temAtribuicao(c) {
    const codC = padCliente8Cadastro(c);
    if (codEd && codC === codEd) {
      const raw = String(pessoaCampoAtual ?? '').trim();
      if (raw) {
        const n = Number(raw.replace(/\D/g, ''));
        if (Number.isFinite(n) && n >= 1) return true;
      }
    }
    return clienteTemPessoaAtribuida(codC, clientesApiFront);
  }

  for (const c of codes) {
    if (!temAtribuicao(c)) return c;
  }
  if (codes.length === 0) {
    return obterProximoCodigoClienteSugerido();
  }
  const maxNum = Math.max(...codes.map((cc) => Number(String(cc).replace(/\D/g, '')) || 0));
  return padCliente8Cadastro(maxNum + 1);
}

/**
 * Mescla linhas do mock com sobrescritas salvas (mesmo id = mesmo proc).
 * Inclui processos extras só presentes no persistido (ex.: incluídos pelo usuário).
 */
export function mergeProcessosLista(mockProcessos, persistedProcessos) {
  if (!Array.isArray(mockProcessos) || mockProcessos.length === 0) {
    return Array.isArray(persistedProcessos) ? [...persistedProcessos] : [];
  }
  if (!Array.isArray(persistedProcessos) || persistedProcessos.length === 0) {
    return mockProcessos.map((r) => ({ ...r }));
  }
  const byId = new Map(persistedProcessos.map((p) => [p.id, p]));
  const merged = mockProcessos.map((row) => {
    const o = byId.get(row.id);
    if (!o) return { ...row };
    return {
      ...row,
      processoVelho: o.processoVelho !== undefined ? o.processoVelho : row.processoVelho,
      processoNovo: o.processoNovo !== undefined ? o.processoNovo : row.processoNovo,
      parteOposta: o.parteOposta !== undefined ? o.parteOposta : row.parteOposta,
      descricao: o.descricao !== undefined ? o.descricao : row.descricao,
      autor: o.autor !== undefined ? o.autor : row.autor,
      reu: o.reu !== undefined ? o.reu : row.reu,
      tipoAcao: o.tipoAcao !== undefined ? o.tipoAcao : row.tipoAcao,
      procNumero: row.procNumero,
    };
  });
  const mockIds = new Set(mockProcessos.map((r) => r.id));
  const extras = persistedProcessos.filter((p) => p && p.id && !mockIds.has(p.id));
  return [...merged, ...extras];
}

export function loadCadastroClienteDados(codClienteRaw) {
  const key = padCliente8Cadastro(codClienteRaw);
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_CADASTRO_CLIENTES_DADOS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const row = parsed[key];
    if (!row || typeof row !== 'object') return null;
    return row;
  } catch {
    return null;
  }
}

/**
 * @param {string} codClienteRaw
 * @param {{
 *   pessoa?: string,
 *   nomeRazao?: string,
 *   cnpjCpf?: string,
 *   observacao?: string,
 *   clienteInativo?: boolean,
 *   edicaoDesabilitada?: boolean,
 *   processos?: Array<object>,
 * }} dados
 */
export function saveCadastroClienteDados(codClienteRaw, dados) {
  const key = padCliente8Cadastro(codClienteRaw);
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_CADASTRO_CLIENTES_DADOS);
    const parsed = raw ? JSON.parse(raw) : {};
    const bag = parsed && typeof parsed === 'object' ? parsed : {};
    const prev = bag[key] && typeof bag[key] === 'object' ? bag[key] : {};
    bag[key] = {
      ...prev,
      ...dados,
      atualizadoEm: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_CADASTRO_CLIENTES_DADOS, JSON.stringify(bag));
    try {
      window.localStorage.setItem(STORAGE_ULTIMO_COD_CLIENTE, JSON.stringify({ codigo: key }));
    } catch {
      /* ignore */
    }
  } catch {
    /* quota */
  }
}
