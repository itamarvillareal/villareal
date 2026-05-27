import { useMemo, useState, useEffect } from 'react';
import { getApiUsuarioSessao } from '../data/usuarioPermissoesStorage.js';
import { featureFlags } from '../config/featureFlags.js';

/** Perfil ADMIN no seed (V1__init). */
export const PERFIL_ADMIN_ID = 1;

/** Perfil USUARIO padrão para cadastros novos. */
export const PERFIL_USUARIO_ID = 2;

function lerPerfilIdSessao() {
  const u = getApiUsuarioSessao();
  if (u?.perfilId == null) return null;
  const n = Number(u.perfilId);
  return Number.isFinite(n) ? n : null;
}

/** Perfil do usuário logado (JWT). Sem API auth, assume admin para não restringir mock local. */
export function getPerfilIdUsuarioLogado() {
  if (!featureFlags.requiresApiAuth) return PERFIL_ADMIN_ID;
  return lerPerfilIdSessao();
}

export function isAdminUsuarioLogado() {
  const pid = getPerfilIdUsuarioLogado();
  return pid == null || pid === PERFIL_ADMIN_ID;
}

/**
 * Hook reativo ao login/logout e atualização de sessão API.
 */
export function useUsuarioPerfil() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener('vilareal:usuario-sessao-atualizada', h);
    window.addEventListener('vilareal:operador-estacao-atualizado', h);
    return () => {
      window.removeEventListener('vilareal:usuario-sessao-atualizada', h);
      window.removeEventListener('vilareal:operador-estacao-atualizado', h);
    };
  }, []);

  return useMemo(() => {
    const perfilId = getPerfilIdUsuarioLogado();
    return {
      perfilId,
      isAdmin: isAdminUsuarioLogado(),
    };
  }, [tick]);
}
