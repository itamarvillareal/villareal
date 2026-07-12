import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Loader2 } from 'lucide-react';
import {
  baixarPdfAcertoFechamentoApi,
  obterAcertoResumoPeriodosApi,
} from '../../../../repositories/financeiroRepository.js';
import { formatMoeda } from '../../shared/financeiroFormat.js';
import { useFinanceiroToast } from '../../shared/Toast.jsx';
import { fmtDataAcerto } from './acertoUtils.js';

const ROTULO_STATUS = {
  FECHADO_MANUAL: 'Fechado (corte manual)',
  FECHADO_AUTO: 'Fechado (saldo zerou)',
  FECHADO: 'Fechado (acerto formal)',
  ABERTO: 'Período aberto',
};

function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Timeline/accordion de períodos do acerto (Etapa 5c): fechados recolhidos, aberto expandido.
 */
export function AcertoPeriodosView({
  numeroBanco,
  clienteId,
  refreshKey,
  periodoSel,
  onSelecionarPeriodo,
  onResumoCarregado,
}) {
  const toast = useFinanceiroToast();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [expandidos, setExpandidos] = useState(() => new Set());

  useEffect(() => {
    if (numeroBanco == null || !clienteId) {
      setDados(null);
      return undefined;
    }
    const ac = new AbortController();
    setCarregando(true);
    obterAcertoResumoPeriodosApi({ numeroBanco, clienteId }, { signal: ac.signal })
      .then((r) => {
        setDados(r ?? null);
        onResumoCarregado?.(r ?? null);
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setDados(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setCarregando(false);
      });
    return () => ac.abort();
  }, [numeroBanco, clienteId, refreshKey]);

  const periodos = useMemo(() => (Array.isArray(dados?.periodos) ? dados.periodos : []), [dados]);
  const abertoIdx = dados?.periodoAbertoIndice;

  useEffect(() => {
    if (abertoIdx != null && periodoSel == null) {
      onSelecionarPeriodo?.(abertoIdx);
    }
  }, [abertoIdx, periodoSel, onSelecionarPeriodo]);

  useEffect(() => {
    const next = new Set();
    if (abertoIdx != null) next.add(abertoIdx);
    if (mostrarHistorico) {
      periodos.forEach((p) => {
        if (p.status !== 'ABERTO') next.add(p.indice);
      });
    }
    setExpandidos(next);
  }, [abertoIdx, mostrarHistorico, periodos]);

  const periodoAtivo = periodos.find((p) => p.indice === periodoSel) ?? null;

  const baixarPdf = async (fechamentoId) => {
    try {
      const blob = await baixarPdfAcertoFechamentoApi(fechamentoId);
      baixarBlob(blob, `acerto_periodo_${fechamentoId}.pdf`);
    } catch (e) {
      toast.error(e?.message || 'Falha ao baixar o PDF.');
    }
  };

  const alternar = (idx) => {
    setExpandidos((s) => {
      const n = new Set(s);
      if (n.has(idx)) n.delete(idx);
      else n.add(idx);
      return n;
    });
    onSelecionarPeriodo?.(idx);
  };

  if (!clienteId) return null;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Períodos do acerto</h2>
          <p className="text-[11px] text-slate-500">
            {dados?.ultimoCorteData
              ? `Último corte: ${fmtDataAcerto(dados.ultimoCorteData)}`
              : 'Sem corte anterior — todo o histórico está aberto'}
            {dados?.dataUltimoAcertoConhecido
              ? ` · corte manual ${fmtDataAcerto(dados.dataUltimoAcertoConhecido)}`
              : ''}
          </p>
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={mostrarHistorico}
            onChange={(e) => setMostrarHistorico(e.target.checked)}
          />
          Mostrar histórico fechado
        </label>
      </div>

      {carregando ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Calculando períodos…
        </p>
      ) : periodos.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">Nenhum lançamento nesta conta para o cliente.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {periodos.map((p) => {
            const fechado = p.status !== 'ABERTO';
            if (fechado && !mostrarHistorico && p.indice !== periodoSel) {
              return (
                <li key={p.indice}>
                  <button
                    type="button"
                    onClick={() => onSelecionarPeriodo?.(p.indice)}
                    className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      periodoSel === p.indice ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''
                    }`}
                  >
                    <span className="text-slate-500">
                      {p.dataFim ? fmtDataAcerto(p.dataFim) : '—'} · {ROTULO_STATUS[p.status] ?? p.status} ·{' '}
                      {Number(p.qtdLancamentos).toLocaleString('pt-BR')} lanç. · zerado
                      {Number(p.naoConferidos) > 0
                        ? ` · ${Number(p.naoConferidos)} sem conferir`
                        : ' · conferido'}
                    </span>
                  </button>
                </li>
              );
            }

            const aberto = expandidos.has(p.indice) || p.status === 'ABERTO';
            const ativo = periodoSel === p.indice;
            const destaque = p.status === 'ABERTO';

            return (
              <li
                key={p.indice}
                className={
                  destaque
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
                    : ativo
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                      : ''
                }
              >
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => alternar(p.indice)}
                    className="px-3 flex items-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelecionarPeriodo?.(p.indice)}
                    className="flex-1 text-left py-2.5 pr-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {p.status === 'ABERTO'
                          ? `Aberto desde ${p.dataInicio ? fmtDataAcerto(p.dataInicio) : '—'}`
                          : `Até ${p.dataFim ? fmtDataAcerto(p.dataFim) : '—'}`}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${
                          destaque
                            ? 'border-emerald-400 text-emerald-800 bg-emerald-100'
                            : 'border-slate-300 text-slate-600'
                        }`}
                      >
                        {ROTULO_STATUS[p.status] ?? p.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      {Number(p.qtdLancamentos).toLocaleString('pt-BR')} lanç. ·{' '}
                      {Number(p.qtdProcessos).toLocaleString('pt-BR')} procs
                      {p.status === 'ABERTO' ? (
                        <>
                          {' '}
                          · saldo {formatMoeda(Number(p.saldoFinal ?? 0))} ·{' '}
                          {Number(p.pendentes).toLocaleString('pt-BR')} pend. ·{' '}
                          {Number(p.naoConferidos).toLocaleString('pt-BR')} sem conferir
                        </>
                      ) : (
                        <> · saldo {formatMoeda(Number(p.saldoFinal ?? 0))}</>
                      )}
                    </p>
                  </button>
                  {p.fechamentoId && p.temPdf ? (
                    <button
                      type="button"
                      onClick={() => void baixarPdf(p.fechamentoId)}
                      className="self-center mr-3 inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Download className="w-3 h-3" /> PDF
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {periodoAtivo && periodoAtivo.status !== 'ABERTO' ? (
        <p className="px-4 py-2 text-[11px] text-amber-800 dark:text-amber-200 border-t border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/20">
          Período fechado — somente leitura. Use &quot;Mostrar histórico fechado&quot; para alternar entre
          períodos antigos.
        </p>
      ) : null}
    </section>
  );
}
