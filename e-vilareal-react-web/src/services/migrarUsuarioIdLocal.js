import { substituirUsuarioIdNaAgendaPersistida } from '../data/agendaPersistenciaData.js';
import {
  loadPermissoesMapa,
  savePermissoesMapa,
  getUsuarioSessaoAtualId,
  setUsuarioSessaoAtualId,
  getOperadorEstacaoId,
  setOperadorEstacaoId,
} from '../data/usuarioPermissoesStorage.js';

const PENDENCIAS_STORAGE_KEY_V2 = 'pendencias_por_usuario_v2';

/**
 * Renomeia referências ao id de usuário no armazenamento local (agenda, permissões, pendências, sessão).
 * Não usar com API de usuários (id é chave no servidor).
 */
export function migrarUsuarioIdLocal(antigoId, novoId) {
  const antigo = String(antigoId ?? '').trim();
  const novo = String(novoId ?? '').trim();
  if (!antigo || !novo || antigo === novo) return;

  substituirUsuarioIdNaAgendaPersistida(antigo, novo);

  const map = loadPermissoesMapa();
  if (Object.prototype.hasOwnProperty.call(map, antigo)) {
    const nextMap = { ...map };
    if (!Object.prototype.hasOwnProperty.call(nextMap, novo)) {
      nextMap[novo] = nextMap[antigo];
    }
    delete nextMap[antigo];
    savePermissoesMapa(nextMap);
  }

  if (getUsuarioSessaoAtualId() === antigo) setUsuarioSessaoAtualId(novo);
  if (getOperadorEstacaoId() === antigo) setOperadorEstacaoId(novo);

  try {
    const raw = window.localStorage.getItem(PENDENCIAS_STORAGE_KEY_V2);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object' && !Array.isArray(p) && Object.prototype.hasOwnProperty.call(p, antigo)) {
        const next = { ...p };
        if (!Object.prototype.hasOwnProperty.call(next, novo)) {
          next[novo] = next[antigo];
        }
        delete next[antigo];
        window.localStorage.setItem(PENDENCIAS_STORAGE_KEY_V2, JSON.stringify(next));
      }
    }
  } catch {
    /* ignore */
  }
}
