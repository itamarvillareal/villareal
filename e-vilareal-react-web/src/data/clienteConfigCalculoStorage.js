/**
 * Configurações padrão de cálculo por cliente (Cadastro de Clientes).
 * Usadas na tela Cálculos quando não há personalização por processo (rodada).
 */

export const STORAGE_CLIENTE_CONFIG_CALCULO = 'vilareal.cliente.configCalculo.v1';

export function padCliente8Config(val) {
  const s = String(val ?? '').replace(/\D/g, '');
  const n = s ? Number(s) : 1;
  if (!Number.isFinite(n) || n < 1) return '00000001';
  return String(Math.floor(n)).padStart(8, '0');
}

/** Valores alinhados ao legado e à tela Cálculos. */
export const DEFAULT_CONFIG_CALCULO_CLIENTE = {
  honorariosTipo: 'fixos',
  /** Valor exibido no campo quando honorários fixos */
  honorariosValor: '0',
  /** Texto livre para faixas (honorários variáveis), ex.: legado Excel */
  honorariosVariaveisTexto: '> 30 = 0%\n< 30 < 60 = 10%\n< 60 = 20%',
  juros: '1 %',
  multa: '0 %',
  indice: 'INPC',
  periodicidade: 'mensal',
  modeloListaDebitos: '01',
};

function dispatchAtualizado() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vilareal:cliente-config-calculo-atualizado'));
  }
}

/**
 * Configuração completa (defaults + o que foi salvo para o cliente).
 */
export function loadConfigCalculoCliente(codCliente) {
  const key = padCliente8Config(codCliente);
  const base = { ...DEFAULT_CONFIG_CALCULO_CLIENTE };
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_CLIENTE_CONFIG_CALCULO);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    const row = parsed[key];
    if (!row || typeof row !== 'object') return base;
    return { ...base, ...row };
  } catch {
    return base;
  }
}

/**
 * @param {string} codCliente
 * @param {Partial<typeof DEFAULT_CONFIG_CALCULO_CLIENTE>} config
 */
export function saveConfigCalculoCliente(codCliente, config) {
  const key = padCliente8Config(codCliente);
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_CLIENTE_CONFIG_CALCULO);
    const parsed = raw ? JSON.parse(raw) : {};
    const bag = parsed && typeof parsed === 'object' ? parsed : {};
    bag[key] = {
      ...DEFAULT_CONFIG_CALCULO_CLIENTE,
      ...(bag[key] && typeof bag[key] === 'object' ? bag[key] : {}),
      ...config,
    };
    window.localStorage.setItem(STORAGE_CLIENTE_CONFIG_CALCULO, JSON.stringify(bag));
    dispatchAtualizado();
  } catch {
    /* quota */
  }
}

/**
 * Mescla defaults do cliente com sobrescritas da rodada (processo/dimensão).
 */
export function mergeConfigPainelCalculo(defCliente, panelConfig) {
  const d = { ...DEFAULT_CONFIG_CALCULO_CLIENTE, ...defCliente };
  if (!panelConfig || typeof panelConfig !== 'object') return d;
  return { ...d, ...panelConfig };
}
