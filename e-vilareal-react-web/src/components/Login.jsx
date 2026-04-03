import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { featureFlags } from '../config/featureFlags.js';

export function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from && typeof location.state.from === 'string' ? location.state.from : '/';

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  if (!featureFlags.requiresApiAuth) {
    return <Navigate to="/" replace />;
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    const u = usuario.trim();
    if (!u || !senha) {
      setErro('Informe login e senha.');
      return;
    }
    setCarregando(true);
    try {
      await login(u, senha);
      navigate(from, { replace: true });
    } catch (err) {
      setErro(err?.message || 'Falha no login.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-8">
        <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100 mb-6">
          <LogIn className="w-7 h-7 text-blue-600 dark:text-cyan-400" aria-hidden />
          <h1 className="text-xl font-semibold">Acesso — API Villareal</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Entre com o usuário do backend (após Flyway: login <code className="text-xs">itamar</code>, senha{' '}
          <code className="text-xs">123456</code>). O token é guardado nesta aba
          (sessionStorage) e enviado nas requisições <code className="text-xs">/api/…</code>.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="vl-login" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Login
            </label>
            <input
              id="vl-login"
              type="text"
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label htmlFor="vl-senha" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Senha
            </label>
            <input
              id="vl-senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          {erro ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {erro}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 transition-colors"
          >
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
