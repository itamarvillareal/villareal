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
  return { hasCod, codRaw, hasProcKey, procRaw, processoApiId: null };
}

/**
 * Intent de navegação unificando `location.state` e query string (`?codigoCliente=&numeroInterno=&processoId=`).
 * Query string é fallback quando o state do React Router se perde (ex.: refresh, lazy route).
 *
 * @param {Pick<import('react-router-dom').Location, 'state'|'search'> | null | undefined} location
 */
export function resolverIntentNavegacaoProcessosDeRota(location) {
  const fromState = extrairIntentNavegacaoProcessos(location?.state);
  const params = new URLSearchParams(location?.search ?? '');

  const codRaw =
    (fromState?.hasCod ? fromState.codRaw : null) ??
    params.get(CHAVE_API_CODIGO_CLIENTE) ??
    params.get(CHAVE_HISTORICO_CODIGO_CLIENTE);
  const procRaw =
    (fromState?.hasProcKey ? fromState.procRaw : null) ??
    params.get(CHAVE_API_NUMERO_INTERNO_PROCESSO) ??
    params.get(CHAVE_HISTORICO_NUMERO_INTERNO) ??
    params.get('processo');

  const hasCod = codRaw != null && String(codRaw).trim() !== '';
  const hasProcKey = procRaw != null && String(procRaw).trim() !== '';

  const apiIdRaw =
    location?.state?.processoApiId ??
    location?.state?.processoId ??
    params.get('processoId') ??
    params.get('processoApiId');
  const processoApiId =
    apiIdRaw != null && Number.isFinite(Number(apiIdRaw)) && Number(apiIdRaw) > 0
      ? Number(apiIdRaw)
      : null;

  if (!hasCod && !hasProcKey && processoApiId == null) return null;
  return { hasCod, codRaw, hasProcKey, procRaw, processoApiId };
}

function numeroInternoFromIntentRaw(procRaw) {
  if (procRaw == null || String(procRaw).trim() === '') return null;
  const num = parseInt(String(procRaw), 10);
  if (Number.isNaN(num) || num < 1) return null;
  return num;
}

/** Valores iniciais de cliente/proc. ao montar Processos (prioriza rota sobre localStorage). */
export function resolverSelecaoInicialProcessos(location) {
  const intent = resolverIntentNavegacaoProcessosDeRota(location);
  const saved = lerUltimaSelecaoProcessosArmazenamento();
  if (intent?.hasCod) {
    return {
      codigoCliente: padCliente(intent.codRaw),
      numeroInterno: numeroInternoFromIntentRaw(intent.procRaw) ?? saved?.numeroInterno ?? 1,
    };
  }
  if (saved) {
    return { codigoCliente: saved.codigoCliente, numeroInterno: saved.numeroInterno };
  }
  return { codigoCliente: padCliente('00000001'), numeroInterno: 1 };
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

/**
 * Destino React Router para abrir Processos (ou sub-rota) com state + query string redundantes.
 *
 * @param {string} pathname
 * @param {string|number|null|undefined} codigoClienteRaw
 * @param {string|number|null|undefined} numeroInternoRaw
 * @param {Record<string, unknown>} [extra]
 */
export function buildLinkDestinoProcesso(pathname, codigoClienteRaw, numeroInternoRaw, extra = {}) {
  const hasCod = codigoClienteRaw != null && String(codigoClienteRaw).trim() !== '';
  const hasProc = numeroInternoRaw != null && String(numeroInternoRaw).trim() !== '';
  const state =
    hasCod || hasProc
      ? buildRouterStateChaveClienteProcesso(
          hasCod ? codigoClienteRaw : '',
          hasProc ? numeroInternoRaw : '',
          extra,
        )
      : Object.keys(extra).length > 0
        ? { ...extra }
        : undefined;

  const params = new URLSearchParams();
  if (hasCod) {
    const cod = padCliente(codigoClienteRaw);
    params.set(CHAVE_API_CODIGO_CLIENTE, cod);
    params.set(CHAVE_HISTORICO_CODIGO_CLIENTE, cod);
  }
  if (hasProc) {
    const procStr = String(numeroInternoRaw).trim();
    params.set(CHAVE_HISTORICO_NUMERO_INTERNO, procStr);
    params.set(CHAVE_API_NUMERO_INTERNO_PROCESSO, procStr);
  }
  const apiId = extra.processoApiId ?? extra.processoId;
  if (apiId != null && Number.isFinite(Number(apiId)) && Number(apiId) > 0) {
    params.set('processoId', String(Number(apiId)));
  }

  const search = params.toString();
  return {
    pathname,
    search: search ? `?${search}` : '',
    state,
  };
}
