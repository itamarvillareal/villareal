import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearAccessToken, getAccessToken, setAccessToken } from '../api/authTokenStorage.js';
import { fetchAuthLogin, fetchAuthMe } from '../api/authApiService.js';
import {
  setApiUsuarioSessao,
  clearApiUsuarioSessao,
  setUsuarioSessaoAtualId,
  getApiUsuarioSessao,
} from '../data/usuarioPermissoesStorage.js';
import { featureFlags } from '../config/featureFlags.js';
import { listarUsuarios } from '../repositories/usuariosRepository.js';
import { gravarSnapshotUsuariosApi } from '../services/syncApiUsuariosSnapshot.js';

const AuthContext = createContext(null);

/** Chave em sessionStorage: mensagem exibida na tela de login após encerrar sessão por inatividade. */
export const IDLE_SESSION_MESSAGE_STORAGE_KEY = 'vilareal.logoutMessageIdle.v1';

const SESSION_IDLE_MS = 60 * 60 * 1000;
const SESSION_IDLE_CHECK_MS = 30_000;

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getAccessToken());
  const lastActivityRef = useRef(Date.now());

  /** Recarregar aba com JWT válido: repõe sessão de operador/perfil e snapshot de usuários. */
  useEffect(() => {
    if (!featureFlags.requiresApiAuth) return;
    const t = getAccessToken();
    if (!t) return;
    if (getApiUsuarioSessao()) return;
    let cancelled = false;
    (async () => {
      try {
        const u = await fetchAuthMe();
        if (cancelled || u?.id == null) return;
        setApiUsuarioSessao({ id: u.id, nome: u.nome, login: u.login });
        setUsuarioSessaoAtualId(String(u.id));
        if (featureFlags.useApiUsuarios) {
          try {
            const lista = await listarUsuarios();
            gravarSnapshotUsuariosApi(lista || []);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* 401 tratado no httpClient */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const on401 = () => {
      setTokenState('');
      clearApiUsuarioSessao();
    };
    window.addEventListener('vilareal:api-unauthorized', on401);
    return () => window.removeEventListener('vilareal:api-unauthorized', on401);
  }, []);

  /** Encerra sessão após 1 h sem interação (apenas com login JWT obrigatório). */
  useEffect(() => {
    if (!featureFlags.requiresApiAuth || !token) return;
    lastActivityRef.current = Date.now();

    const mark = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
    const opts = { capture: true, passive: true };
    for (const ev of events) {
      document.addEventListener(ev, mark, opts);
    }

    const intervalId = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= SESSION_IDLE_MS) {
        try {
          sessionStorage.setItem(
            IDLE_SESSION_MESSAGE_STORAGE_KEY,
            'Sua sessão foi encerrada por 1 hora sem atividade. Faça login novamente.',
          );
        } catch {
          /* ignore */
        }
        clearAccessToken();
        clearApiUsuarioSessao();
        setTokenState('');
      }
    }, SESSION_IDLE_CHECK_MS);

    return () => {
      window.clearInterval(intervalId);
      for (const ev of events) {
        document.removeEventListener(ev, mark, opts);
      }
    };
  }, [token]);

  const login = useCallback(async (loginStr, senha) => {
    const data = await fetchAuthLogin(loginStr, senha);
    const access = data?.accessToken;
    if (!access || typeof access !== 'string') {
      throw new Error('Resposta de login sem accessToken.');
    }
    setAccessToken(access);
    setTokenState(access);
    lastActivityRef.current = Date.now();
    const u = data?.usuario;
    if (u?.id != null) {
      setApiUsuarioSessao({
        id: u.id,
        nome: u.nome,
        login: u.login,
      });
    }
    if (featureFlags.useApiUsuarios) {
      try {
        const lista = await listarUsuarios();
        gravarSnapshotUsuariosApi(lista || []);
      } catch {
        /* lista da sidebar preenchida ao abrir Usuários */
      }
    }
    if (u?.id != null) {
      setUsuarioSessaoAtualId(String(u.id));
    }
    return data;
  }, []);

  const logout = useCallback(() => {
    clearAccessToken();
    clearApiUsuarioSessao();
    setTokenState('');
  }, []);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return ctx;
}
