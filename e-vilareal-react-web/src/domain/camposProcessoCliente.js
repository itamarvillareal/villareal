/**
 * Campos canônicos: código do cliente × número interno do processo
 * =================================================================
 *
 * Conceito único no domínio (API Java / colunas relacionadas):
 * - **codigoCliente** — VARCHAR(8), mesmo valor em «Código do Cliente» (Clientes ou Processos).
 * - **numeroInterno** — inteiro ≥ 1 (ou 0 só para fluxo Conta Corrente Proc. 0); mesmo que «Proc.» na grade
 *   de Clientes ou «Processo» no formulário Processos.
 *
 * Aliases aceitos (apenas apresentação ou legado JSON — não são campos distintos):
 * - localStorage histórico de processos (`processosHistoricoData`): chaves `codCliente` e `proc`.
 * - React state UI: `codigo` (Clientes) e `codigoCliente` (Processos); `procNumero` (grade) e `processo` (Processos).
 * - Router `location.state`: histórico `codCliente` + `proc`; preferir também `codigoCliente` + `numeroInterno`.
 *
 * Regra: novos fluxos devem gravar/ler os nomes canônicos; aliases existem só para compatibilidade.
 */

import { padCliente } from '../data/processosDadosRelatorio.js';

export const CHAVE_API_CODIGO_CLIENTE = 'codigoCliente';
export const CHAVE_API_NUMERO_INTERNO_PROCESSO = 'numeroInterno';
/** Chaves no JSON `vilareal:processos-historico:v1` (legado, equivalentes às canônicas). */
export const CHAVE_HISTORICO_CODIGO_CLIENTE = 'codCliente';
export const CHAVE_HISTORICO_NUMERO_INTERNO = 'proc';

const STORAGE_ULTIMA_SELECAO_PROCESSOS = 'vilareal:processos:ultima-selecao:v1';

/**
 * `location.state` ao abrir `/processos`. Aceita aliases; retorno interno usa nomes canônicos na leitura.
 */
export function extrairIntentNavegacaoProcessos(state) {
  if (!state || typeof state !== 'object') return null;
  const codRaw =
    state[CHAVE_API_CODIGO_CLIENTE] ??
    state[CHAVE_HISTORICO_CODIGO_CLIENTE] ??
    state.codigo_cliente ??
    null;
  const hasCod = codRaw != null && String(codRaw).trim() !== '';

  const hasNumeroInterno = Object.prototype.hasOwnProperty.call(state, CHAVE_API_NUMERO_INTERNO_PROCESSO);
  const hasProc = Object.prototype.hasOwnProperty.call(state, CHAVE_HISTORICO_NUMERO_INTERNO);
  const hasProcesso = Object.prototype.hasOwnProperty.call(state, 'processo');

  const procRaw = hasNumeroInterno
    ? state[CHAVE_API_NUMERO_INTERNO_PROCESSO]
    : hasProc
      ? state[CHAVE_HISTORICO_NUMERO_INTERNO]
      : hasProcesso
        ? state.processo
        : undefined;

  const hasProcKey = hasNumeroInterno || hasProc || hasProcesso;

  if (!hasCod && !hasProcKey) return null;
  return { hasCod, codRaw, hasProcKey, procRaw };
}

/**
 * Persistência da última chave em Processos (somente chaves canônicas no JSON gravado).
 * @returns {{ codigoCliente: string, numeroInterno: number } | null}
 */
export function lerUltimaSelecaoProcessosArmazenamento() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_ULTIMA_SELECAO_PROCESSOS);
    if (!raw) return null;
    const o = JSON.parse(raw);
    const cod = o?.[CHAVE_API_CODIGO_CLIENTE] ?? o?.[CHAVE_HISTORICO_CODIGO_CLIENTE];
    if (cod == null || String(cod).trim() === '') return null;
    const procVal =
      o?.[CHAVE_API_NUMERO_INTERNO_PROCESSO] ?? o?.processo ?? o?.[CHAVE_HISTORICO_NUMERO_INTERNO];
    const p = Number(procVal);
    const numeroInterno = Number.isFinite(p) && p >= 1 ? Math.floor(p) : 4;
    return { codigoCliente: padCliente(cod), numeroInterno };
  } catch {
    return null;
  }
}

/**
 * @param {string|number} codigoClienteRaw
 * @param {string|number} numeroInternoRaw — nº do processo no cliente (UI «Proc.» / «Processo»)
 */
export function gravarUltimaSelecaoProcessosArmazenamento(codigoClienteRaw, numeroInternoRaw) {
  if (typeof window === 'undefined') return;
  try {
    const p = Number(numeroInternoRaw);
    const numeroInterno = Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1;
    window.localStorage.setItem(
      STORAGE_ULTIMA_SELECAO_PROCESSOS,
      JSON.stringify({
        [CHAVE_API_CODIGO_CLIENTE]: padCliente(codigoClienteRaw),
        [CHAVE_API_NUMERO_INTERNO_PROCESSO]: numeroInterno,
      })
    );
  } catch {
    /* ignore */
  }
}

/**
 * State do React Router com a mesma chave natural em todos os módulos (Clientes, Processos, Financeiro, …).
 * Inclui aliases legados (`codCliente`, `proc`) com os **mesmos valores** — não são dados duplicados.
 *
 * @param {string|number} codigoClienteRaw
 * @param {string|number|undefined|null} numeroInternoRaw — omitir ou vazio: não envia proc/numeroInterno
 * @param {Record<string, unknown>} [extra]
 */
export function buildRouterStateChaveClienteProcesso(codigoClienteRaw, numeroInternoRaw, extra = {}) {
  const cod = padCliente(codigoClienteRaw);
  const procStr =
    numeroInternoRaw != null && String(numeroInternoRaw).trim() !== '' ? String(numeroInternoRaw) : '';
  const out = {
    ...extra,
    [CHAVE_API_CODIGO_CLIENTE]: cod,
    [CHAVE_HISTORICO_CODIGO_CLIENTE]: cod,
  };
  if (procStr !== '') {
    out[CHAVE_HISTORICO_NUMERO_INTERNO] = procStr;
    const n = parseInt(procStr, 10);
    if (!Number.isNaN(n)) {
      out[CHAVE_API_NUMERO_INTERNO_PROCESSO] = n;
    }
  }
  return out;
}
