import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  listarContadoresEtapaApi,
  listarGruposCompensacaoInconsistentesApi,
  listarLancamentosFinanceiroPaginados,
  obterSaudeFinanceiroApi,
} from '../../../repositories/financeiroRepository.js';
import { Pagination } from '../shared/Pagination.jsx';
import { ValorText } from '../shared/ValorText.jsx';
import { ExtratoSkeleton } from '../shared/LoadingSkeleton.jsx';
import {
  formatDataCurta,
  formatMoeda,
  grupoFechado,
  somaAssinadaLancamentos,
} from '../shared/financeiroFormat.js';

const SUGESTAO_BADGE = {
  DIFERENCA_TAXA: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  DUPLICADO: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  INCOMPLETO: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  REVISAR_MANUAL: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

const SUGESTAO_LABEL = {
  DIFERENCA_TAXA: 'Taxa',
  DUPLICADO: 'Duplicado',
  INCOMPLETO: 'Incompleto',
  REVISAR_MANUAL: 'Revisar',
};

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-500 text-blue-700 dark:text-blue-300'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

function GrupoStatusBadge({ lancamentos }) {
  if (!lancamentos?.length) return null;
  const soma = somaAssinadaLancamentos(lancamentos);
  if (lancamentos.length >= 2 && grupoFechado(soma)) {
    return (
      <span className="ml-2 text-[11px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        ✓ Fechado
      </span>
    );
  }
  if (Math.abs(soma) > 0.01) {
    return (
      <span className="ml-2 text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        ⚠ Diferença {formatMoeda(soma)}
      </span>
    );
  }
  return null;
}

export function CompensacaoPage() {
  const [tab, setTab] = useState('validos');
  const [countCompensado, setCountCompensado] = useState(0);
  const [countInconsistentes, setCountInconsistentes] = useState(0);

  const [validosRows, setValidosRows] = useState([]);
  const [validosPage, setValidosPage] = useState(0);
  const [validosSize] = useState(50);
  const [validosTotal, setValidosTotal] = useState(0);
  const [validosPages, setValidosPages] = useState(0);
  const [validosLoading, setValidosLoading] = useState(false);

  const [gruposInc, setGruposInc] = useState([]);
  const [incPage, setIncPage] = useState(0);
  const [incSize] = useState(20);
  const [incTotal, setIncTotal] = useState(0);
  const [incPages, setIncPages] = useState(0);
  const [incLoading, setIncLoading] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    Promise.all([
      listarContadoresEtapaApi({ signal: ac.signal }),
      obterSaudeFinanceiroApi({ signal: ac.signal }),
    ])
      .then(([contadores, saude]) => {
        setCountCompensado(Number(contadores?.COMPENSADO) || 0);
        setCountInconsistentes(Number(saude?.gruposInconsistentes) || 0);
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || tab !== 'validos') return undefined;
    const ac = new AbortController();
    setValidosLoading(true);
    setErro('');
    listarLancamentosFinanceiroPaginados(
      { etapa: 'COMPENSADO', page: validosPage, size: validosSize, sort: 'dataLancamento,desc' },
      { signal: ac.signal },
    )
      .then((res) => {
        setValidosRows(res?.content ?? []);
        setValidosTotal(Number(res?.totalElements) || 0);
        setValidosPages(Number(res?.totalPages) || 0);
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setErro(e?.message || 'Erro ao carregar grupos válidos.');
      })
      .finally(() => setValidosLoading(false));
    return () => ac.abort();
  }, [tab, validosPage, validosSize]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || tab !== 'inconsistentes') return undefined;
    const ac = new AbortController();
    setIncLoading(true);
    setErro('');
    listarGruposCompensacaoInconsistentesApi({ page: incPage, size: incSize, signal: ac.signal })
      .then((res) => {
        setGruposInc(res?.grupos ?? []);
        setIncTotal(Number(res?.total) || 0);
        setIncPages(Number(res?.totalPages) || 0);
        setExpanded(new Set());
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setErro(e?.message || 'Erro ao carregar inconsistentes.');
      })
      .finally(() => setIncLoading(false));
    return () => ac.abort();
  }, [tab, incPage, incSize]);

  const gruposValidos = useMemo(() => {
    const map = new Map();
    for (const row of validosRows) {
      const g = String(row.grupoCompensacao ?? '').trim() || '(sem grupo)';
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(row);
    }
    return [...map.entries()].sort((a, b) => String(b[1][0]?.dataLancamento).localeCompare(String(a[1][0]?.dataLancamento)));
  }, [validosRows]);

  const toggleExpand = (grupo) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(grupo)) next.delete(grupo);
      else next.add(grupo);
      return next;
    });
  };

  if (!featureFlags.useApiFinanceiro) {
    return (
      <p className="p-4 text-sm text-slate-600 dark:text-slate-400">API financeiro desativada.</p>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full bg-white dark:bg-slate-900">
      <div className="flex border-b border-slate-200 dark:border-slate-700 px-2">
        <TabButton active={tab === 'validos'} onClick={() => setTab('validos')}>
          Grupos válidos ({countCompensado.toLocaleString('pt-BR')})
        </TabButton>
        <TabButton active={tab === 'inconsistentes'} onClick={() => setTab('inconsistentes')}>
          Inconsistentes ({countInconsistentes.toLocaleString('pt-BR')})
        </TabButton>
      </div>

      {erro ? (
        <p className="px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40">{erro}</p>
      ) : null}

      {tab === 'validos' ? (
        <>
          <div className="flex-1 min-h-0 overflow-auto">
            {validosLoading ? (
              <ExtratoSkeleton />
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr
                    className="text-xs font-medium text-slate-500 dark:text-slate-400"
                    style={{ background: 'var(--fin-header-bg)' }}
                  >
                    <th className="px-2 py-2 text-left">Grupo</th>
                    <th className="px-2 py-2 text-left">Banco</th>
                    <th className="px-2 py-2 text-left">Data</th>
                    <th className="px-2 py-2 text-left">Descrição</th>
                    <th className="px-2 py-2 text-right">Valor</th>
                    <th className="px-2 py-2 text-left">Natureza</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposValidos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        Nenhum lançamento compensado.
                      </td>
                    </tr>
                  ) : (
                    gruposValidos.map(([grupo, lancamentos], gi) => {
                      const bg = gi % 2 === 0 ? 'var(--fin-row-alt)' : 'transparent';
                      return lancamentos.map((row, ri) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 dark:border-slate-800"
                          style={{ background: bg }}
                        >
                          <td className="px-2 py-1.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                            {ri === 0 ? (
                              <>
                                {grupo}
                                <GrupoStatusBadge lancamentos={lancamentos} />
                              </>
                            ) : null}
                          </td>
                          <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                            {row.bancoNome ?? row.numeroBanco ?? '—'}
                          </td>
                          <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                            {formatDataCurta(row.dataLancamento)}
                          </td>
                          <td className="px-2 py-1.5 text-slate-900 dark:text-slate-100 truncate max-w-md">
                            {row.descricao}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <ValorText valor={row.valor} natureza={row.natureza} />
                          </td>
                          <td className="px-2 py-1.5 text-xs text-slate-500">{row.natureza}</td>
                        </tr>
                      ));
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
          <Pagination
            page={validosPage}
            totalPages={validosPages}
            totalItems={validosTotal}
            pageSize={validosSize}
            onPageChange={setValidosPage}
            onPageSizeChange={() => {}}
          />
        </>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-auto">
            {incLoading ? (
              <ExtratoSkeleton />
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr
                    className="text-xs font-medium text-slate-500"
                    style={{ background: 'var(--fin-header-bg)' }}
                  >
                    <th className="w-8 px-1 py-2" />
                    <th className="px-2 py-2 text-left">Grupo</th>
                    <th className="px-2 py-2 text-right">Soma</th>
                    <th className="px-2 py-2 text-left">Sugestão</th>
                    <th className="px-2 py-2 text-right">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposInc.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        Nenhum grupo inconsistente.
                      </td>
                    </tr>
                  ) : (
                    gruposInc.map((g) => {
                      const key = g.grupoCompensacao;
                      const open = expanded.has(key);
                      const sug = String(g.sugestao ?? 'REVISAR_MANUAL');
                      return (
                        <Fragment key={key}>
                          <tr
                            className="border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            onClick={() => toggleExpand(key)}
                          >
                            <td className="px-2 py-2 text-slate-400">
                              {open ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </td>
                            <td className="px-2 py-2 font-mono text-xs">{key}</td>
                            <td className="px-2 py-2 text-right font-medium tabular-nums">
                              {formatMoeda(g.soma)}
                            </td>
                            <td className="px-2 py-2">
                              <span
                                className={`text-[11px] font-medium px-2 py-0.5 rounded ${SUGESTAO_BADGE[sug] ?? SUGESTAO_BADGE.REVISAR_MANUAL}`}
                                title={g.descricaoSugestao}
                              >
                                {SUGESTAO_LABEL[sug] ?? sug}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right text-slate-500">
                              {g.lancamentos?.length ?? 0}
                            </td>
                          </tr>
                          {open
                            ? (g.lancamentos ?? []).map((l) => (
                                <tr
                                  key={l.id}
                                  className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800"
                                >
                                  <td />
                                  <td className="px-2 py-1 text-slate-500 text-xs" colSpan={2}>
                                    {formatDataCurta(l.dataLancamento)} · {l.bancoNome}
                                  </td>
                                  <td className="px-2 py-1 text-slate-800 dark:text-slate-200 truncate" colSpan={2}>
                                    {l.descricao}{' '}
                                    <span className="tabular-nums">
                                      (
                                      <ValorText valor={l.valor} natureza={l.natureza} />)
                                    </span>
                                  </td>
                                </tr>
                              ))
                            : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
          <Pagination
            page={incPage}
            totalPages={incPages}
            totalItems={incTotal}
            pageSize={incSize}
            onPageChange={setIncPage}
            onPageSizeChange={() => {}}
          />
        </>
      )}
    </div>
  );
}
