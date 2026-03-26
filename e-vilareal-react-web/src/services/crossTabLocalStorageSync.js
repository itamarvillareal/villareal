/**
 * Sincronização entre abas: `CustomEvent` não atravessa abas; mudanças em `localStorage`
 * disparam `storage` apenas nas outras janelas. Reemitimos os eventos que a UI já escuta.
 */

import {
  STORAGE_OPERADOR_ESTACAO,
  STORAGE_PERMISSOES_USUARIOS,
  STORAGE_USUARIO_SESSAO_ATIVA,
} from '../data/usuarioPermissoesStorage.js';
import { STORAGE_CALCULOS_RODADAS_KEY } from '../data/calculosRodadasStorage.js';
import { STORAGE_CLIENTE_CONFIG_CALCULO } from '../data/clienteConfigCalculoStorage.js';
import { STORAGE_CADASTRO_CLIENTES_DADOS } from '../data/cadastroClientesStorage.js';
import {
  STORAGE_FINANCEIRO_CONTAS_CONTABEIS_EXTRAS_KEY,
  STORAGE_FINANCEIRO_CONTAS_CONTABEIS_INATIVAS_KEY,
  STORAGE_FINANCEIRO_CONTAS_EXTRAS_KEY,
  STORAGE_FINANCEIRO_EXTRATOS_INATIVOS_KEY,
  STORAGE_FINANCEIRO_EXTRATOS_KEY,
} from '../data/financeiroData.js';
import { invalidateProcessosHistoricoStoreCache } from '../data/processosHistoricoData.js';

const STORAGE_AGENDA_USUARIOS_V3 = 'vilareal:agenda-usuarios:v3';
const STORAGE_AGENDA_EVENTOS_V2 = 'vilareal:agenda-eventos:v2';
const STORAGE_AGENDA_EVENTOS_V1 = 'vilareal:agenda-eventos:v1';
const STORAGE_PROCESSOS_HISTORICO = 'vilareal:processos-historico:v1';
const PENDENCIAS_V2 = 'pendencias_por_usuario_v2';
const PENDENCIAS_V1 = 'pendencias_por_usuario_v1';

export const EVENT_PROCESSOS_HISTORICO_ATUALIZADO = 'vilareal:processos-historico-atualizado';
export const EVENT_PENDENCIAS_STORAGE_ATUALIZADO = 'vilareal:pendencias-por-usuario-atualizadas';
export const EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA = 'vilareal:financeiro-persistencia-externa';
export const EVENT_RELATORIO_PERSISTENCIA_EXTERNA = 'vilareal:relatorio-persistencia-externa';

function emit(name, detail) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    /* ignore */
  }
}

function emitFullRefresh() {
  invalidateProcessosHistoricoStoreCache();
  emit(EVENT_PROCESSOS_HISTORICO_ATUALIZADO);
  emit('vilareal:usuarios-agenda-atualizados');
  emit('vilareal:agenda-persistencia-atualizada');
  emit('vilareal:usuario-sessao-atualizada');
  emit('vilareal:permissoes-usuarios-atualizadas');
  emit('vilareal:operador-estacao-atualizado');
  emit(EVENT_PENDENCIAS_STORAGE_ATUALIZADO);
  emit('vilareal:calculos-rodadas-atualizadas');
  emit('vilareal:cliente-config-calculo-atualizado');
  emit('vilareal:cadastro-clientes-externo-atualizado');
  emit(EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA);
  emit(EVENT_RELATORIO_PERSISTENCIA_EXTERNA);
}

function handleStorageKey(key) {
  if (key == null) {
    emitFullRefresh();
    return;
  }

  switch (key) {
    case STORAGE_PERMISSOES_USUARIOS:
      emit('vilareal:permissoes-usuarios-atualizadas');
      return;
    case STORAGE_USUARIO_SESSAO_ATIVA:
      emit('vilareal:usuario-sessao-atualizada');
      return;
    case STORAGE_OPERADOR_ESTACAO:
      emit('vilareal:operador-estacao-atualizado');
      return;
    case STORAGE_AGENDA_USUARIOS_V3:
      emit('vilareal:usuarios-agenda-atualizados');
      return;
    case STORAGE_AGENDA_EVENTOS_V2:
    case STORAGE_AGENDA_EVENTOS_V1:
      emit('vilareal:agenda-persistencia-atualizada');
      return;
    case STORAGE_PROCESSOS_HISTORICO:
      invalidateProcessosHistoricoStoreCache();
      emit(EVENT_PROCESSOS_HISTORICO_ATUALIZADO);
      return;
    case PENDENCIAS_V2:
    case PENDENCIAS_V1:
      emit(EVENT_PENDENCIAS_STORAGE_ATUALIZADO);
      return;
    case STORAGE_CALCULOS_RODADAS_KEY:
      emit('vilareal:calculos-rodadas-atualizadas');
      return;
    case STORAGE_CLIENTE_CONFIG_CALCULO:
      emit('vilareal:cliente-config-calculo-atualizado');
      return;
    case STORAGE_CADASTRO_CLIENTES_DADOS:
      emit('vilareal:cadastro-clientes-externo-atualizado');
      return;
    default:
      break;
  }

  if (
    key === STORAGE_FINANCEIRO_EXTRATOS_KEY ||
    key === STORAGE_FINANCEIRO_EXTRATOS_INATIVOS_KEY ||
    key === STORAGE_FINANCEIRO_CONTAS_EXTRAS_KEY ||
    key === STORAGE_FINANCEIRO_CONTAS_CONTABEIS_EXTRAS_KEY ||
    key === STORAGE_FINANCEIRO_CONTAS_CONTABEIS_INATIVAS_KEY ||
    (typeof key === 'string' && key.startsWith('vilareal.financeiro.extratos.'))
  ) {
    emit(EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA);
    return;
  }

  if (typeof key === 'string' && key.startsWith('vilareal.relatorioProcessos.')) {
    emit(EVENT_RELATORIO_PERSISTENCIA_EXTERNA);
  }
}

/**
 * @returns {() => void} função para remover o listener (ex.: testes ou HMR)
 */
export function installCrossTabLocalStorageSync() {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e) => {
    if (e.storageArea !== window.localStorage) return;
    handleStorageKey(e.key);
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
