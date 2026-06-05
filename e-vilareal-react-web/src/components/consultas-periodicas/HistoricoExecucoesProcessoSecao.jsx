import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, History, Loader2 } from 'lucide-react';
import { formatarDateTimePainel, labelStatusUltimaExecucao } from '../../domain/agendamentoCadencia.js';
import { listarExecucoesProcesso } from '../../repositories/agendamentoRepository.js';

/**
 * Histórico de execuções de consulta/monitor do processo (retraído por padrão).
 * @param {{ processoApiId?: number|string|null }} props
 */
export function HistoricoExecucoesProcessoSecao({ processoApiId }) {
  const procId = Number(processoApiId);
  const habilitado = Number.isFinite(procId) && procId > 0;

  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [carregou, setCarregou] = useState(false);

  const carregar = useCallback(async () => {
    if (!habilitado) return;
    setCarregando(true);
    setErro('');
    try {
      const page = await listarExecucoesProcesso(procId, 0, 30);
      const content = page?.content ?? page;
      setItens(Array.isArray(content) ? content : []);
      setCarregou(true);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar histórico de execuções.');
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, [habilitado, procId]);

  useEffect(() => {
    if (aberto && !carregou) {
      void carregar();
    }
  }, [aberto, carregou, carregar]);

  if (!habilitado) return null;

  return (
    <section
      className="rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-[#0d1018]/80"
      aria-labelledby="historico-execucoes-titulo"
    >
      <button
        type="button"
        id="historico-execucoes-titulo"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50/80 dark:hover:bg-white/5 rounded-lg"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        {aberto ? (
          <ChevronDown className="w-4 h-4 shrink-0 text-slate-500" aria-hidden />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" aria-hidden />
        )}
        <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden />
        Histórico de execuções
        {carregou && itens.length > 0 ? (
          <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
            ({itens.length})
          </span>
        ) : null}
      </button>

      {aberto ? (
        <div className="border-t border-slate-200/80 dark:border-white/10 px-3 py-2">
          {erro ? (
            <p className="text-xs text-red-700 dark:text-red-300 mb-2">{erro}</p>
          ) : null}
          {carregando ? (
            <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 py-2">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Carregando histórico…
            </p>
          ) : itens.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-1">
              Nenhuma execução registrada para este processo.
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {itens.map((ex) => (
                <li
                  key={ex.id}
                  className="rounded border border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-[#0d1018]/60 px-2 py-1.5 text-[11px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="tabular-nums text-slate-700 dark:text-slate-200">
                      {formatarDateTimePainel(ex.iniciadaEm)}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {labelStatusUltimaExecucao(ex.status) || ex.status || '—'}
                    </span>
                  </div>
                  {ex.teoresNovos > 0 ? (
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                      {ex.teoresNovos} novidade(s)
                      {ex.origem ? ` · ${ex.origem}` : ''}
                    </p>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-500 mt-0.5">
                      Sem novidades{ex.origem ? ` · ${ex.origem}` : ''}
                    </p>
                  )}
                  {ex.erro ? (
                    <p className="text-red-700/90 dark:text-red-300/90 mt-0.5 line-clamp-2" title={ex.erro}>
                      {ex.erro}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
