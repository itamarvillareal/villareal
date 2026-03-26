/**
 * Remove do navegador persistências ligadas a demonstração / mock / legado local.
 * Não remove tema (`vilareal.theme.dark`).
 *
 * Uso no console (dev):
 * `import('/src/utils/clearLocalMockData.js').then((m) => m.clearLocalMockData({ nuclear: true, clearAuth: true }))`
 *
 * @param {{ clearAuth?: boolean, nuclear?: boolean }} [opts]
 *   — `clearAuth=true` remove JWT e sessão API (obrigatório novo login).
 *   — `nuclear=true` remove todas as chaves `vilareal*` e `pendencias_*` do localStorage/sessionStorage (exceto tema).
 * Sempre remove rascunhos de redação em processos: `sessionStorage` com prefixo `e-vilareal-acao-redacao:`.
 * @returns {{ removedLocalStorage: string[], removedSessionStorage: string[] }}
 */
import { clearAccessToken } from '../api/authTokenStorage.js';

const THEME_KEY = 'vilareal.theme.dark';
const STORAGE_API_USUARIO_SESSAO = 'vilareal.auth.usuarioLogado.v1';

/** Chaves explícitas conhecidas (dados demo, migrações locais, relatórios, financeiro legado). */
const LOCAL_STORAGE_KEYS = [
  'vilareal:cadastro-pessoas:mock-novos:v1',
  'vilareal:cadastro-pessoas:mock-marcado-monitoramento:v1',
  'vilareal.processos.publicacoes.v2',
  'vilareal.processos.publicacoes.v1',
  'vilareal.calculos.rodadas.v1',
  'vilareal.cliente.configCalculo.v1',
  'vilareal.cadastroPessoas.documentos.v1',
  'vilareal:indices-mensais:v1',
  'pendencias_por_usuario_v1',
  'pendencias_por_usuario_v2',
  'vilareal:processos-historico:v1',
  'vilareal:processos-historico:demo-seed-version',
  'vilareal:demo-persistence:schema',
  'vilareal:processos:edicao-desabilitada-ao-sair:v1',
  'vilareal:agenda-eventos:v1',
  'vilareal:agenda-eventos:v2',
  'vilareal:agenda-usuarios:v1',
  'vilareal:agenda-usuarios:v2',
  'vilareal:agenda-usuarios:v3',
  'vilareal:agenda-eventos:ids-remap-legado:v1',
  'vilareal:legacy-ids-mock-agenda:v2',
  'vilareal:cadastro-clientes-dados:v1',
  'vilareal:cadastro-clientes-ultimo-cod:v1',
  'vilareal.usuarios.permissoes.v1',
  'vilareal.usuario.sessaoAtiva.v1',
  'vilareal.usuario.operadorEstacao.v1',
  'vilareal:migration:phase2-3:done:v1',
  'vilareal:migration:phase4-processos:done:v1',
  'vilareal:migration:phase5-financeiro:done:v1',
  'vilareal:migration:phase6-publicacoes:done:v1',
  'vilareal:migration:phase7-imoveis:lastRun:v1',
  'vilareal:demo-integrado:version',
  'vilareal.relatorioProcessos.presets.v1',
  'vilareal.relatorioProcessos.colunasVisiveis.v1',
  'vilareal.relatorioProcessos.larguraUniforme.v1',
  'vilareal.relatorioProcessos.filtroProcessoAtivo.v1',
  'vilareal.relatorioProcessos.modoAlteracao.v1',
  'vilareal.relatorioProcessos.dadosLinhas.v1',
  'vilareal.relatorioProcessos.campoColunaUltimoAndamento.v1',
  'vilareal.relatorioProcessos.campoPorColuna.v1',
  'vilareal.financeiro.extratos.v20',
  'vilareal.financeiro.extratos.inativos.v1',
  'vilareal.financeiro.contasExtras.v1',
  'vilareal.financeiro.contasContabeis.extras.v1',
  'vilareal.financeiro.contasContabeis.inativas.v1',
  'vilareal.financeiro.consultasVinculo.log.v1',
  'vilareal.usuario.master',
  'vilareal:financeiro:layout-relatorios:v1',
  'vilareal:financeiro:exibicao-relatorios:v2',
];

function removeByPrefix(store, prefix, removed) {
  if (typeof window === 'undefined') return;
  const keys = [];
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (k && k.startsWith(prefix) && k !== THEME_KEY) keys.push(k);
  }
  for (const k of keys) {
    store.removeItem(k);
    removed.push(k);
  }
}

function removeAllVilarealLikeKeys(store, removed, themeKey) {
  if (typeof window === 'undefined') return;
  const keys = [];
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (!k || k === themeKey) continue;
    if (k.startsWith('vilareal') || k.startsWith('pendencias_')) keys.push(k);
  }
  for (const k of keys) {
    store.removeItem(k);
    removed.push(k);
  }
}

function removeLegacyFinanceiroExtratos(removed) {
  if (typeof window === 'undefined') return;
  const re = /^vilareal\.financeiro\.extratos\.v\d+$/;
  const keys = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const k = window.localStorage.key(i);
    if (k && re.test(k)) keys.push(k);
  }
  for (const k of keys) {
    window.localStorage.removeItem(k);
    removed.push(k);
  }
}

/**
 * @param {{ clearAuth?: boolean, nuclear?: boolean }} [opts]
 */
export function clearLocalMockData(opts = {}) {
  const clearAuth = Boolean(opts.clearAuth);
  const nuclear = Boolean(opts.nuclear);
  const removedLocalStorage = [];
  const removedSessionStorage = [];

  if (typeof window === 'undefined') {
    return { removedLocalStorage, removedSessionStorage };
  }

  if (nuclear) {
    removeAllVilarealLikeKeys(window.localStorage, removedLocalStorage, THEME_KEY);
    removeAllVilarealLikeKeys(window.sessionStorage, removedSessionStorage, THEME_KEY);
  }

  for (const k of LOCAL_STORAGE_KEYS) {
    if (!nuclear && window.localStorage.getItem(k) != null) {
      window.localStorage.removeItem(k);
      removedLocalStorage.push(k);
    }
  }

  if (!nuclear) {
    removeByPrefix(window.localStorage, 'vilareal.datajud.cache.', removedLocalStorage);
    removeLegacyFinanceiroExtratos(removedLocalStorage);

    removeByPrefix(window.localStorage, 'vilareal:cadastro-pessoas:', removedLocalStorage);
    removeByPrefix(window.sessionStorage, 'vilareal:cadastro-pessoas:', removedSessionStorage);
  }

  removeByPrefix(window.sessionStorage, 'e-vilareal-acao-redacao:', removedSessionStorage);

  if (clearAuth) {
    clearAccessToken();
    removedSessionStorage.push('vilareal.accessToken');
    try {
      if (window.sessionStorage.getItem(STORAGE_API_USUARIO_SESSAO) != null) {
        window.sessionStorage.removeItem(STORAGE_API_USUARIO_SESSAO);
        removedSessionStorage.push(STORAGE_API_USUARIO_SESSAO);
      }
    } catch {
      /* ignore */
    }
  }

  return { removedLocalStorage, removedSessionStorage };
}

/** Varredura máxima no navegador (dados app + JWT + sessão API). */
export function runFullBrowserDataSweep() {
  return clearLocalMockData({ nuclear: true, clearAuth: true });
}
