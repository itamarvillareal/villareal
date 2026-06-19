import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACCESS_TOKEN_STORAGE_KEY,
  LAST_ACTIVITY_STORAGE_KEY,
  clearAccessToken,
  clearLastAuthActivity,
  getAccessToken,
  getLastAuthActivityMs,
  setAccessToken,
  touchLastAuthActivity,
} from '../api/authTokenStorage.js';
import { fetchAuthLogin, fetchAuthMe } from '../api/authApiService.js';
import {
  setApiUsuarioSessao,
  clearApiUsuarioSessao,
  setUsuarioSessaoAtualId,
  getApiUsuarioSessao,
  STORAGE_API_USUARIO_SESSAO,
} from '../data/usuarioPermissoesStorage.js';
import { featureFlags } from '../config/featureFlags.js';
import { listarUsuarios } from '../repositories/usuariosRepository.js';
import { gravarSnapshotUsuariosApi } from '../services/syncApiUsuariosSnapshot.js';
import { clearPublicacoesPreviasSession } from '../data/publicacoesPreviasSession.js';

const AuthContext = createContext(null);

/** Chave em sessionStorage: mensagem exibida na tela de login após encerrar sessão por inatividade. */
export const IDLE_SESSION_MESSAGE_STORAGE_KEY = 'vilareal.logoutMessageIdle.v1';

const SESSION_IDLE_MS = 18 * 60 * 60 * 1000;
const SESSION_IDLE_CHECK_MS = 30_000;

function resolveLastActivityMs(localRef) {
  return Math.max(localRef, getLastAuthActivityMs());
}

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getAccessToken());
  const lastActivityRef = useRef(resolveLastActivityMs(Date.now()));

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
        setApiUsuarioSessao({ id: u.id, nome: u.nome, login: u.login, perfilId: u.perfilId });
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

  /** Login/logout em outra aba: sincroniza token e encerra sessão local se necessário. */
  useEffect(() => {
    if (!featureFlags.requiresApiAuth) return undefined;
    const onStorage = (e) => {
      if (e.key === ACCESS_TOKEN_STORAGE_KEY) {
        const t = getAccessToken();
        setTokenState(t);
        if (!t) {
          clearApiUsuarioSessao();
          clearPublicacoesPreviasSession();
        }
        return;
      }
      if (e.key === LAST_ACTIVITY_STORAGE_KEY && e.newValue) {
        const n = parseInt(e.newValue, 10);
        if (Number.isFinite(n)) {
          lastActivityRef.current = Math.max(lastActivityRef.current, n);
        }
        return;
      }
      if (e.key === STORAGE_API_USUARIO_SESSAO) {
        window.dispatchEvent(new CustomEvent('vilareal:usuario-sessao-atualizada'));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const on401 = () => {
      setTokenState('');
      clearApiUsuarioSessao();
      clearPublicacoesPreviasSession();
    };
    window.addEventListener('vilareal:api-unauthorized', on401);
    return () => window.removeEventListener('vilareal:api-unauthorized', on401);
  }, []);

  /** Encerra sessão após 18 h sem interação em qualquer aba (apenas com login JWT obrigatório). */
  useEffect(() => {
    if (!featureFlags.requiresApiAuth || !token) return;
    lastActivityRef.current = resolveLastActivityMs(lastActivityRef.current);
    touchLastAuthActivity(lastActivityRef.current);

    const mark = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      touchLastAuthActivity(now);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
    const opts = { capture: true, passive: true };
    for (const ev of events) {
      document.addEventListener(ev, mark, opts);
    }

    const intervalId = window.setInterval(() => {
      const last = resolveLastActivityMs(lastActivityRef.current);
      lastActivityRef.current = last;
      if (Date.now() - last >= SESSION_IDLE_MS) {
        try {
          sessionStorage.setItem(
            IDLE_SESSION_MESSAGE_STORAGE_KEY,
            'Sua sessão foi encerrada por 18 horas sem atividade. Faça login novamente.',
          );
        } catch {
          /* ignore */
        }
        clearAccessToken();
        clearApiUsuarioSessao();
        clearPublicacoesPreviasSession();
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
    clearPublicacoesPreviasSession();
    const data = await fetchAuthLogin(loginStr, senha);
    const access = data?.accessToken;
    if (!access || typeof access !== 'string') {
      throw new Error('Resposta de login sem accessToken.');
    }
    setAccessToken(access);
    setTokenState(access);
    const now = Date.now();
    lastActivityRef.current = now;
    touchLastAuthActivity(now);
    const u = data?.usuario;
    if (u?.id != null) {
      setApiUsuarioSessao({
        id: u.id,
        nome: u.nome,
        login: u.login,
        perfilId: u.perfilId,
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
    clearPublicacoesPreviasSession();
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
