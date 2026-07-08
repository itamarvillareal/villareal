import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { obterCodigoPdpj } from '../repositories/configuracaoRepository.js';

/**
 * Visor do código TOTP de 6 dígitos para login PDPJ/PJe TRT18.
 */
export function VisorCodigoPdpj() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [tick, setTick] = useState(0);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const resp = await obterCodigoPdpj();
      setDados(resp);
    } catch (e) {
      setDados(null);
      const msg = String(e?.message ?? '');
      if (msg.includes('403') || /acesso negado|forbidden/i.test(msg)) {
        setErro('Acesso restrito a administradores.');
      } else if (msg.includes('404') || /não encontrad/i.test(msg)) {
        setErro('Credencial PDPJ não configurada no servidor.');
      } else {
        setErro(msg || 'Falha ao obter código PDPJ.');
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!dados || carregando) return undefined;
    const restantes = Math.max(0, Number(dados.segundosRestantes ?? 0) - 1);
    if (restantes <= 0) {
      void carregar();
      return undefined;
    }
    setDados((prev) => (prev ? { ...prev, segundosRestantes: restantes } : prev));
    return undefined;
  }, [tick, dados?.codigo, carregando, carregar]);

  const periodo = Math.max(1, Number(dados?.periodoSegundos ?? 30));
  const restantes = Math.max(0, Number(dados?.segundosRestantes ?? 0));
  const progresso = Math.min(100, Math.max(0, ((periodo - restantes) / periodo) * 100));
  const codigo = String(dados?.codigo ?? '').padStart(Number(dados?.digitos ?? 6), '0');

  return (
    <div className="border-t border-slate-200 pt-6">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-sky-100 border border-sky-200 shrink-0">
          <KeyRound className="w-5 h-5 text-sky-800" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Código PDPJ (PJe TRT18)</h2>
            <p className="text-sm text-slate-600 mt-1">
              Código de <strong>6 dígitos</strong> do autenticador para login{' '}
              <strong>Entrar com PDPJ</strong>. Renova a cada {periodo} segundos.
            </p>
          </div>

          {carregando && !dados ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Carregando código…
            </div>
          ) : null}

          {erro ? (
            <p className="text-sm text-rose-700 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
              {erro}
            </p>
          ) : null}

          {codigo && !erro ? (
            <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
              <div
                className="font-mono text-4xl sm:text-5xl font-bold tracking-[0.35em] text-sky-900 text-center tabular-nums select-all"
                aria-live="polite"
                aria-label={`Código PDPJ: ${codigo.split('').join(' ')}`}
              >
                {codigo}
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span>Renova em {restantes}s</span>
                  {dados?.loginMascarado ? (
                    <span className="font-mono text-slate-500">{dados.loginMascarado}</span>
                  ) : null}
                </div>
                <div className="h-1.5 rounded-full bg-sky-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${progresso}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCarregando(true);
                  void carregar();
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-sky-800 hover:text-sky-950"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden />
                Atualizar agora
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
