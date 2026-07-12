import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Loader2, Search } from 'lucide-react';
import {
  baixarPdfAcertoFechamentoApi,
  obterAcertoResumoPeriodosApi,
} from '../../../../repositories/financeiroRepository.js';
import { formatMoeda } from '../../shared/financeiroFormat.js';
import { useFinanceiroToast } from '../../shared/Toast.jsx';
import { fmtDataAcerto } from './acertoUtils.js';

const ROTULO_STATUS = {
  FECHADO_MANUAL: 'Histórico (corte manual)',
  FECHADO_GRUPO: 'Card fechado',
  FECHADO_AUTO: 'Histórico (saldo zerou)',
  FECHADO: 'Acerto formal',
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

function isCard(p) {
  return p.status === 'FECHADO_GRUPO' || p.tipoPeriodo === 'CARD';
}

function isHistorico(p) {
  return p.status !== 'ABERTO' && !isCard(p);
}

function filtrarBusca(lista, busca) {
  const q = busca.trim().toLowerCase();
  if (!q) return lista;
  return lista.filter((p) => {
    const hay = [
      p.titulo,
      p.grupoCompensacao,
      p.numeroInternoProcesso != null ? String(p.numeroInternoProcesso) : '',
      p.dataFim,
      p.dataInicio,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

function PeriodoItem({
  p,
  ativo,
  expandido,
  onAlternar,
  onSelecionar,
  onBaixarPdf,
  destaqueAberto = false,
}) {
  const abertoUi = expandido || p.status === 'ABERTO';
  const card = isCard(p);

  return (
    <li
      className={
        destaqueAberto
          ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
          : ativo
            ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
            : card
              ? 'bg-slate-50/80 dark:bg-slate-800/30'
              : ''
      }
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => onAlternar(p.indice)}
          className="px-3 flex items-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
        >
          {abertoUi ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <button type="button" onClick={() => onSelecionar(p.indice)} className="flex-1 text-left py-2.5 pr-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {p.titulo
                ? p.titulo
                : p.status === 'ABERTO'
                  ? `Aberto desde ${p.dataInicio ? fmtDataAcerto(p.dataInicio) : '—'}`
                  : `Até ${p.dataFim ? fmtDataAcerto(p.dataFim) : '—'}`}
            </span>
            {p.numeroInternoProcesso != null ? (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-300 text-slate-600">
                proc {p.numeroInternoProcesso}
              </span>
            ) : null}
            {card ? (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-indigo-300 text-indigo-700 bg-indigo-50">
                {p.grupoCompensacao ?? 'card'}
              </span>
            ) : null}
            <span
              className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${
                destaqueAberto
                  ? 'border-emerald-400 text-emerald-800 bg-emerald-100'
                  : card
                    ? 'border-indigo-300 text-indigo-700'
                    : 'border-slate-300 text-slate-600'
              }`}
            >
              {ROTULO_STATUS[p.status] ?? p.status}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            {p.dataFim ? fmtDataAcerto(p.dataFim) : p.dataInicio ? fmtDataAcerto(p.dataInicio) : '—'}
            {' · '}
            {Number(p.qtdLancamentos).toLocaleString('pt-BR')} lanç.
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
            onClick={() => void onBaixarPdf(p.fechamentoId)}
            className="self-center mr-3 inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="w-3 h-3" /> PDF
          </button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Cards de acerto + período aberto + histórico (Etapa 5d).
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
  const [busca, setBusca] = useState('');
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
  }, [numeroBanco, clienteId, refreshKey, onResumoCarregado]);

  const periodos = useMemo(() => (Array.isArray(dados?.periodos) ? dados.periodos : []), [dados]);
  const abertoIdx = dados?.periodoAbertoIndice;

  const cards = useMemo(() => filtrarBusca(periodos.filter(isCard), busca), [periodos, busca]);
  const aberto = useMemo(() => periodos.find((p) => p.status === 'ABERTO') ?? null, [periodos]);
  const historico = useMemo(
    () => filtrarBusca(periodos.filter(isHistorico), busca),
    [periodos, busca],
  );

  useEffect(() => {
    if (abertoIdx != null && periodoSel == null) {
      onSelecionarPeriodo?.(abertoIdx);
    }
  }, [abertoIdx, periodoSel, onSelecionarPeriodo]);

  useEffect(() => {
    const next = new Set();
    if (abertoIdx != null) next.add(abertoIdx);
    cards.forEach((p) => next.add(p.indice));
    if (mostrarHistorico) historico.forEach((p) => next.add(p.indice));
    setExpandidos(next);
  }, [abertoIdx, cards, historico, mostrarHistorico]);

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

  const renderLista = (lista, { destaqueAberto = false } = {}) => (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {lista.map((p) => (
        <PeriodoItem
          key={p.indice}
          p={p}
          ativo={periodoSel === p.indice}
          expandido={expandidos.has(p.indice)}
          onAlternar={alternar}
          onSelecionar={onSelecionarPeriodo}
          onBaixarPdf={baixarPdf}
          destaqueAberto={destaqueAberto && p.status === 'ABERTO'}
        />
      ))}
    </ul>
  );

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Cards e períodos</h2>
          <p className="text-[11px] text-slate-500">
            {cards.length > 0 ? `${cards.length} card(s) fechado(s)` : 'Nenhum card ainda'}
            {dados?.dataUltimoAcertoConhecido
              ? ` · corte manual ${fmtDataAcerto(dados.dataUltimoAcertoConhecido)}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Proc, título, grupo…"
              className="pl-7 pr-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 w-44"
            />
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={mostrarHistorico}
              onChange={(e) => setMostrarHistorico(e.target.checked)}
            />
            Histórico
          </label>
        </div>
      </div>

      {carregando ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Calculando…
        </p>
      ) : periodos.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">Nenhum lançamento nesta conta para o cliente.</p>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          <div>
            <h3 className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20">
              Cards de acerto (soma zero)
            </h3>
            {cards.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-500">
                Nenhum card com grupo compensado. Use parear-grupo ou o script de backfill.
              </p>
            ) : (
              renderLista(cards)
            )}
          </div>

          <div>
            <h3 className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20">
              Período aberto
            </h3>
            {aberto ? renderLista([aberto], { destaqueAberto: true }) : (
              <p className="px-4 py-3 text-xs text-slate-500">Sem período aberto.</p>
            )}
          </div>

          {mostrarHistorico ? (
            <div>
              <h3 className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                Histórico (sem cards)
              </h3>
              {historico.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-500">Nenhum período histórico.</p>
              ) : (
                renderLista(historico)
              )}
            </div>
          ) : historico.length > 0 ? (
            <p className="px-4 py-2 text-[11px] text-slate-500">
              {historico.length} período(s) histórico(s) oculto(s). Marque &quot;Histórico&quot; para ver.
            </p>
          ) : null}
        </div>
      )}

      {periodoAtivo && periodoAtivo.status !== 'ABERTO' ? (
        <p className="px-4 py-2 text-[11px] text-amber-800 dark:text-amber-200 border-t border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/20">
          {isCard(periodoAtivo)
            ? 'Card fechado — somente leitura. Lançamentos filtrados pelo grupo de compensação.'
            : 'Período fechado — somente leitura.'}
        </p>
      ) : null}
    </section>
  );
}
