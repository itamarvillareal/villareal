import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleDollarSign, ExternalLink, Receipt, RefreshCw } from 'lucide-react';
import { obterQuadroRecebiveisApi } from '../repositories/recebiveisRepository.js';
import { RecebiveisConsolidados } from './RecebiveisConsolidados.jsx';

const TIPOS_CARTAO = [
  { key: 'MENSALIDADE', titulo: 'Mensalistas', contagemRotulo: 'contratos' },
  { key: 'HONORARIOS', titulo: 'Honorários', contagemRotulo: 'itens' },
  { key: 'ALUGUEL', titulo: 'Aluguéis', contagemRotulo: 'itens' },
  { key: 'IPTU', titulo: 'IPTU', contagemRotulo: 'itens' },
];

const ROTULO_TIPO = {
  MENSALIDADE: 'Mensalista',
  HONORARIOS: 'Honorários',
  ALUGUEL: 'Aluguel',
  IPTU: 'IPTU',
  OUTRO: 'Outro',
};

const STATUS_BADGE = {
  VENCIDO: 'bg-red-100 text-red-900 border-red-300',
  RECEBIDO: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  A_VENCER: 'bg-slate-100 text-slate-800 border-slate-300',
};

const STATUS_LABEL = {
  VENCIDO: 'Vencido',
  RECEBIDO: 'Recebido',
  A_VENCER: 'A vencer',
};

function formatBRL(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function formatData(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function competenciaAtual() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
}

function fimDoMes(yyyyMm) {
  const [y, m] = String(yyyyMm).split('-').map(Number);
  if (!y || !m) return '';
  const ultimo = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
}

function normalizarTipo(tipo) {
  return String(tipo || '').toUpperCase();
}

export function QuadroRecebiveis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tipoFiltro = normalizarTipo(searchParams.get('tipo'));
  const cobrancaAberta = searchParams.get('detalhe') === 'cobranca';

  const [modoPeriodo, setModoPeriodo] = useState('ESTE_MES');
  const [periodoCustomInicio, setPeriodoCustomInicio] = useState(() => competenciaAtual());
  const [periodoCustomFim, setPeriodoCustomFim] = useState(() => competenciaAtual());
  const [quadro, setQuadro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [tick, setTick] = useState(0);

  const paramsApi = useMemo(() => {
    if (modoPeriodo === 'CUSTOM') {
      const inicio = `${periodoCustomInicio}-01`;
      const fim = fimDoMes(periodoCustomFim);
      return { inicio, fim };
    }
    return { periodo: modoPeriodo };
  }, [modoPeriodo, periodoCustomInicio, periodoCustomFim]);

  const recarregar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let ativo = true;
    setErro('');
    setCarregando(true);
    obterQuadroRecebiveisApi(paramsApi)
      .then((data) => {
        if (!ativo) return;
        setQuadro(data || null);
      })
      .catch((e) => {
        if (!ativo) return;
        setErro(e?.message || 'Falha ao carregar quadro de recebíveis.');
        setQuadro(null);
      })
      .finally(() => {
        if (!ativo) return;
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [paramsApi, tick]);

  const resumoMap = useMemo(() => {
    const map = {};
    for (const r of quadro?.resumoPorTipo ?? []) {
      map[normalizarTipo(r.tipo)] = r;
    }
    return map;
  }, [quadro]);

  const itensFiltrados = useMemo(() => {
    const itens = quadro?.itens ?? [];
    if (!tipoFiltro) return itens;
    return itens.filter((item) => normalizarTipo(item.tipo) === tipoFiltro);
  }, [quadro, tipoFiltro]);

  const resumoFiltrado = useMemo(() => {
    if (!tipoFiltro) {
      return {
        total: quadro?.totalGeral ?? 0,
        vencido: quadro?.totalVencido ?? 0,
      };
    }
    const r = resumoMap[tipoFiltro] || { total: 0, totalVencido: 0 };
    return { total: r.total ?? 0, vencido: r.totalVencido ?? 0 };
  }, [quadro, resumoMap, tipoFiltro]);

  const definirTipoFiltro = useCallback(
    (tipo) => {
      const next = new URLSearchParams(searchParams);
      next.delete('detalhe');
      if (!tipo || tipo === tipoFiltro) {
        next.delete('tipo');
      } else {
        next.set('tipo', tipo);
      }
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams, tipoFiltro],
  );

  const abrirCobrancaHonorarios = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.set('tipo', 'HONORARIOS');
    next.set('detalhe', 'cobranca');
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams]);

  const voltarAoQuadroFiltrado = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.set('tipo', 'HONORARIOS');
    next.delete('detalhe');
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams]);

  if (cobrancaAberta) {
    return (
      <RecebiveisConsolidados modoDrillDown onVoltar={voltarAoQuadroFiltrado} />
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] p-4">
      <div className="max-w-[1400px] mx-auto space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/25 shrink-0">
                <CircleDollarSign className="w-5 h-5" aria-hidden />
              </span>
              <span className="bg-gradient-to-r from-emerald-800 to-teal-800 dark:from-emerald-200 dark:to-teal-200 bg-clip-text text-transparent">
                Quadro de recebíveis
              </span>
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Visão consolidada do que está a receber no período — honorários, aluguéis, IPTU e cobranças operacionais.
              Em honorários, use <strong>Ver cobrança</strong> para parcelas, vínculo financeiro e Pagamentos.
            </p>
          </div>
          <button
            type="button"
            onClick={recarregar}
            disabled={carregando}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} aria-hidden />
            Atualizar
          </button>
        </div>

        <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">Período</legend>
              {[
                { id: 'ESTE_MES', label: 'Este mês' },
                { id: 'PROXIMO_MES', label: 'Próximo mês' },
                { id: 'CUSTOM', label: 'Período' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer ${
                    modoPeriodo === opt.id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="periodo-quadro"
                    className="sr-only"
                    checked={modoPeriodo === opt.id}
                    onChange={() => setModoPeriodo(opt.id)}
                  />
                  {opt.label}
                </label>
              ))}
            </fieldset>
            {modoPeriodo === 'CUSTOM' ? (
              <>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  De
                  <input
                    type="month"
                    value={periodoCustomInicio}
                    onChange={(e) => setPeriodoCustomInicio(e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Até
                  <input
                    type="month"
                    value={periodoCustomFim}
                    onChange={(e) => setPeriodoCustomFim(e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
              </>
            ) : null}
          </div>
          {quadro?.periodoInicio && quadro?.periodoFim ? (
            <p className="text-xs text-slate-500">
              Período consultado: {formatData(quadro.periodoInicio)} a {formatData(quadro.periodoFim)}
            </p>
          ) : null}
        </div>

        {tipoFiltro ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-2 text-sm text-indigo-950">
            <span>
              Filtro: <strong>{ROTULO_TIPO[tipoFiltro] || tipoFiltro}</strong>
            </span>
            <button
              type="button"
              className="rounded-md border border-indigo-300 bg-white px-2 py-0.5 text-xs font-medium text-indigo-800 hover:bg-indigo-50"
              onClick={() => definirTipoFiltro('')}
            >
              Limpar filtro
            </button>
            {tipoFiltro === 'HONORARIOS' ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-indigo-600 bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                onClick={abrirCobrancaHonorarios}
              >
                <Receipt className="h-3.5 w-3.5" aria-hidden />
                Ver cobrança
              </button>
            ) : null}
          </div>
        ) : null}

        {erro ? <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p> : null}

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
            Total a receber{tipoFiltro ? ` (${ROTULO_TIPO[tipoFiltro] || tipoFiltro})` : ''}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900">
            {carregando ? '…' : formatBRL(resumoFiltrado.total)}
          </p>
          {!carregando && Number(resumoFiltrado.vencido) > 0 ? (
            <p className="text-xs text-red-700 mt-1">
              Vencido: <strong>{formatBRL(resumoFiltrado.vencido)}</strong>
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TIPOS_CARTAO.map((card) => {
            const r = resumoMap[card.key] || { quantidade: 0, total: 0, totalVencido: 0 };
            const ativo = tipoFiltro === card.key;
            return (
              <div
                key={card.key}
                className={`rounded-lg border bg-white shadow-sm p-4 ${
                  ativo ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="text-left flex-1"
                    onClick={() => definirTipoFiltro(card.key)}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.titulo}</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                      {carregando ? '…' : formatBRL(r.total ?? 0)}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {carregando ? '…' : `${r.quantidade ?? 0} ${card.contagemRotulo}`}
                    </p>
                    {!carregando && Number(r.totalVencido) > 0 ? (
                      <p className="text-[11px] text-red-700 mt-1">Vencido: {formatBRL(r.totalVencido)}</p>
                    ) : null}
                  </button>
                  {card.key === 'HONORARIOS' ? (
                    <button
                      type="button"
                      title="Ver cobrança de honorários"
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-800 hover:bg-indigo-100"
                      onClick={abrirCobrancaHonorarios}
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden />
                      Cobrança
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-200">
                  Cliente / imóvel
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-200">
                  Tipo
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-200">
                  Vence
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700 border-b border-slate-200">
                  Valor
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-200">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-200">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-sm text-slate-500 text-center">
                    Carregando…
                  </td>
                </tr>
              ) : null}
              {!carregando && itensFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-sm text-slate-500 text-center">
                    Nenhum recebível em aberto no período{tipoFiltro ? ` para ${ROTULO_TIPO[tipoFiltro] || tipoFiltro}` : ''}.
                  </td>
                </tr>
              ) : null}
              {!carregando
                ? itensFiltrados.map((item) => {
                    const tipo = normalizarTipo(item.tipo);
                    return (
                      <tr key={`${item.origem}-${item.refId}`} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2 text-sm text-slate-800 border-b border-slate-100 align-top break-words">
                          {item.descricao || '—'}
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700 border-b border-slate-100 align-top">
                          {ROTULO_TIPO[tipo] || item.tipo}
                        </td>
                        <td className="px-3 py-2 text-sm tabular-nums text-slate-800 border-b border-slate-100 align-top whitespace-nowrap">
                          {formatData(item.vencimento)}
                        </td>
                        <td className="px-3 py-2 text-sm tabular-nums font-medium text-slate-900 border-b border-slate-100 align-top text-right whitespace-nowrap">
                          {formatBRL(item.valor)}
                        </td>
                        <td className="px-3 py-2 text-sm border-b border-slate-100 align-top">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-semibold ${
                              STATUS_BADGE[normalizarTipo(item.status)] || STATUS_BADGE.A_VENCER
                            }`}
                          >
                            {STATUS_LABEL[normalizarTipo(item.status)] || item.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm border-b border-slate-100 align-top">
                          {tipo === 'HONORARIOS' ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-indigo-700 hover:underline dark:text-indigo-300"
                              onClick={abrirCobrancaHonorarios}
                            >
                              Ver cobrança
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
