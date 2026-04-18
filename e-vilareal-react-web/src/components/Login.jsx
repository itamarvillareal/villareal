import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Lock, User } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-br from-slate-900 via-indigo-950/80 to-slate-900">
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 mb-4 shadow-lg shadow-cyan-500/10">
            <span className="text-xl font-bold tracking-tight text-cyan-300">VR</span>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">VilaReal</h1>
          <p className="mt-2 text-sm text-slate-400">Entre com sua conta para acessar o sistema</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-black/40 p-8">
          <div className="flex items-center gap-2 text-slate-200 mb-6">
            <LogIn className="w-5 h-5 text-cyan-400 shrink-0" aria-hidden />
            <span className="text-sm font-medium">Acesso à API</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="vl-login" className="block text-xs font-medium text-slate-400 mb-1.5">
                Login
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden />
                <input
                  id="vl-login"
                  type="text"
                  autoComplete="username"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/40"
                  placeholder="Digite o usuário"
                />
              </div>
            </div>
            <div>
              <label htmlFor="vl-senha" className="block text-xs font-medium text-slate-400 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden />
                <input
                  id="vl-senha"
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/40"
                  placeholder="Digite a senha"
                />
              </div>
            </div>

            {erro ? (
              <div
                className="rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2.5 text-sm text-red-200"
                role="alert"
              >
                {erro}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-55 disabled:pointer-events-none text-white text-sm font-semibold py-3 transition-colors shadow-lg shadow-cyan-900/30"
            >
              {carregando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-[11px] text-slate-600">
          Requisições autenticadas usam o token JWT desta aba (sessionStorage).
        </p>
      </div>
    </div>
  );
}
