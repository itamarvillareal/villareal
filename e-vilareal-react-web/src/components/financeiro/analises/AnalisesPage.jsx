import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  aplicarRecorrenciaApi,
  listarRecorrenciasApi,
  obterResumoConsolidadoContasApi,
  obterSaudeFinanceiroApi,
} from '../../../repositories/financeiroRepository.js';
import { ETAPAS } from '../constants/financeiroConstants.js';
import { useFinanceiroChrome } from '../FinanceiroContext.jsx';
import { DashboardSkeleton } from '../shared/LoadingSkeleton.jsx';
import { Pagination } from '../shared/Pagination.jsx';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { CONTA_CHART_HEX } from '../consolidado/consolidadoUtils.js';
import { CONTAS_LETRAS } from '../constants/financeiroConstants.js';
import { dispatchRefreshPendentes } from '../hooks/useKeyboardShortcuts.js';
import { AplicarRecorrenciaDialog } from './AplicarRecorrenciaDialog.jsx';
import { RecorrenciaCard } from './RecorrenciaCard.jsx';
import { chavePadraoRecorrencia, pctClassificado } from './analisesUtils.js';

function KpiCard({ label, value, sublabel, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-slate-900 dark:text-slate-100',
    amber: 'text-amber-600 dark:text-amber-400',
    emerald: 'text-emerald-700 dark:text-emerald-400',
  };
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-3 min-w-[140px] flex-1">
      <p className={`text-2xl font-medium leading-none tabular-nums ${tones[tone]}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
      {sublabel ? <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sublabel}</p> : null}
    </div>
  );
}

function DistribuicaoBar({ totaisPorConta }) {
  const linhas = useMemo(() => {
    const entries = CONTAS_LETRAS.map((cod) => ({
      cod,
      qtd: Number(totaisPorConta?.[cod] ?? 0),
    })).filter((x) => x.qtd > 0);
    const max = Math.max(1, ...entries.map((e) => e.qtd));
    return entries.map((e) => ({ ...e, pct: (e.qtd / max) * 100 }));
  }, [totaisPorConta]);

  if (linhas.length === 0) {
    return <p className="text-sm text-slate-500 py-2">Sem dados de distribuição.</p>;
  }

  return (
    <div className="space-y-1.5" role="img" aria-label="Distribuição de lançamentos por conta contábil">
      {linhas.map(({ cod, qtd, pct }) => (
        <div key={cod} className="flex items-center gap-2 text-xs">
          <span className="w-4 font-medium text-slate-600 dark:text-slate-400">{cod}</span>
          <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: CONTA_CHART_HEX[cod] ?? 'var(--fin-conta-n)',
              }}
            />
          </div>
          <span className="w-16 text-right tabular-nums text-slate-500 dark:text-slate-400">
            {qtd.toLocaleString('pt-BR')}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AnalisesPage() {
  const { bancoAtivo, bancos } = useFinanceiroChrome();
  const toast = useFinanceiroToast();

  const [confiancaMinima, setConfiancaMinima] = useState('ALTA');
  const [apenasComPendentes, setApenasComPendentes] = useState(true);

  const [saude, setSaude] = useState(null);
  const [totaisPorConta, setTotaisPorConta] = useState({});
  const [classificaveisRecorrencia, setClassificaveisRecorrencia] = useState(0);
  const [headerLoading, setHeaderLoading] = useState(featureFlags.useApiFinanceiro);

  const [recorrencias, setRecorrencias] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listaLoading, setListaLoading] = useState(false);
  const [listaErro, setListaErro] = useState('');

  const [dialogPadrao, setDialogPadrao] = useState(null);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [criarRegra, setCriarRegra] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [fadingKeys, setFadingKeys] = useState(() => new Set());
  const [busyKey, setBusyKey] = useState(null);

  const [aprovarTodosProgress, setAprovarTodosProgress] = useState(null);
  const cancelarAprovarTodosRef = useRef(false);

  const bancoNome = useMemo(
    () => bancos.find((b) => b.numero === bancoAtivo)?.nome ?? null,
    [bancos, bancoAtivo],
  );

  const subtitulo = bancoNome ? `${bancoNome} · 12 meses` : 'Todas as contas · 12 meses';

  const pendentes = Number(saude?.porEtapa?.[ETAPAS.IMPORTADO] ?? 0);
  const totalLanc = Number(saude?.totalLancamentos ?? 0);
  const pctClass = pctClassificado(totalLanc, pendentes);

  const queryRecorrencias = useMemo(
    () => ({
      confiancaMinima,
      numeroBanco: bancoAtivo,
      apenasComPendentes,
    }),
    [confiancaMinima, bancoAtivo, apenasComPendentes],
  );

  const carregarCabecalho = useCallback(async (signal) => {
    if (!featureFlags.useApiFinanceiro) {
      setHeaderLoading(false);
      return;
    }
    setHeaderLoading(true);
    try {
      const [s, resumo, recKpi] = await Promise.all([
        obterSaudeFinanceiroApi({ signal }),
        obterResumoConsolidadoContasApi({ signal, meses: 12 }),
        listarRecorrenciasApi(
          { ...queryRecorrencias, page: 0, size: 1000, apenasComPendentes: true },
          { signal },
        ),
      ]);
      setSaude(s);
      setTotaisPorConta(resumo?.totaisPorConta ?? {});
      const soma = (recKpi?.content ?? []).reduce((acc, p) => acc + Number(p.qtdPendentes ?? 0), 0);
      setClassificaveisRecorrencia(soma);
    } catch (e) {
      if (e?.name !== 'AbortError') {
        toast.error(e?.message || 'Erro ao carregar indicadores.');
      }
    } finally {
      setHeaderLoading(false);
    }
  }, [queryRecorrencias, toast]);

  const carregarLista = useCallback(async (signal) => {
    if (!featureFlags.useApiFinanceiro) return;
    setListaLoading(true);
    setListaErro('');
    try {
      const res = await listarRecorrenciasApi(
        { ...queryRecorrencias, page, size: pageSize },
        { signal },
      );
      setRecorrencias(Array.isArray(res?.content) ? res.content : []);
      setTotalElements(Number(res?.totalElements) || 0);
      setTotalPages(Math.max(1, Number(res?.totalPages) || 1));
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setListaErro(e?.message || 'Erro ao carregar recorrências.');
      setRecorrencias([]);
    } finally {
      setListaLoading(false);
    }
  }, [queryRecorrencias, page, pageSize]);

  useEffect(() => {
    setPage(0);
  }, [confiancaMinima, bancoAtivo, apenasComPendentes]);

  useEffect(() => {
    const ac = new AbortController();
    carregarCabecalho(ac.signal);
    return () => ac.abort();
  }, [carregarCabecalho]);

  useEffect(() => {
    const ac = new AbortController();
    carregarLista(ac.signal);
    return () => ac.abort();
  }, [carregarLista]);

  const refreshAll = useCallback(() => {
    carregarCabecalho(undefined);
    carregarLista(undefined);
    dispatchRefreshPendentes();
  }, [carregarCabecalho, carregarLista]);

  const removerPadraoComFade = useCallback((padrao) => {
    const key = chavePadraoRecorrencia(padrao);
    setFadingKeys((prev) => new Set(prev).add(key));
    window.setTimeout(() => {
      setRecorrencias((prev) => prev.filter((p) => chavePadraoRecorrencia(p) !== key));
      setFadingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setTotalElements((t) => Math.max(0, t - 1));
    }, 280);
  }, []);

  const abrirDialog = useCallback(
    async (padrao) => {
      setDialogPadrao(padrao);
      setCriarRegra(false);
      setDryRunResult(null);
      setBusyKey(chavePadraoRecorrencia(padrao));
      try {
        const preview = await aplicarRecorrenciaApi({
          descricaoNorm: padrao.descricaoNorm,
          numeroBanco: padrao.numeroBanco,
          contaContabilId: padrao.contaContabilId,
          clienteId: padrao.clienteId ?? null,
          processoId: padrao.processoId ?? null,
          criarRegra: false,
          dryRun: true,
        });
        setDryRunResult(preview);
      } catch (e) {
        toast.error(e?.message || 'Erro ao simular classificação.');
        setDialogPadrao(null);
      } finally {
        setBusyKey(null);
      }
    },
    [toast],
  );

  const confirmarAplicar = useCallback(async () => {
    if (!dialogPadrao) return;
    setAplicando(true);
    try {
      const res = await aplicarRecorrenciaApi({
        descricaoNorm: dialogPadrao.descricaoNorm,
        numeroBanco: dialogPadrao.numeroBanco,
        contaContabilId: dialogPadrao.contaContabilId,
        clienteId: dialogPadrao.clienteId ?? null,
        processoId: dialogPadrao.processoId ?? null,
        criarRegra,
        dryRun: false,
      });
      const n = Number(res?.aplicados ?? 0);
      let msg = `${n.toLocaleString('pt-BR')} lançamento${n === 1 ? '' : 's'} classificado${n === 1 ? '' : 's'} como ${dialogPadrao.contaCodigo}`;
      if (res?.regraCriadaId && !res?.jaExistiaRegra) {
        msg += ' · regra criada';
      }
      toast.success(msg);
      setDialogPadrao(null);
      removerPadraoComFade(dialogPadrao);
      setClassificaveisRecorrencia((v) => Math.max(0, v - n));
      setSaude((prev) => {
        if (!prev) return prev;
        const imp = Number(prev.porEtapa?.[ETAPAS.IMPORTADO] ?? 0);
        return {
          ...prev,
          porEtapa: { ...prev.porEtapa, [ETAPAS.IMPORTADO]: Math.max(0, imp - n) },
        };
      });
      dispatchRefreshPendentes();
    } catch (e) {
      toast.error(e?.message || 'Erro ao classificar lançamentos.');
    } finally {
      setAplicando(false);
    }
  }, [dialogPadrao, criarRegra, toast, removerPadraoComFade]);

  const aprovarTodosAlta = useCallback(async () => {
    cancelarAprovarTodosRef.current = false;
    try {
      const res = await listarRecorrenciasApi({
        confiancaMinima: 'ALTA',
        numeroBanco: bancoAtivo,
        apenasComPendentes: true,
        page: 0,
        size: 1000,
      });
      const padroesAlta = (res?.content ?? []).filter(
        (p) => String(p.confianca ?? '').toUpperCase() === 'ALTA' && Number(p.qtdPendentes) > 0,
      );
      if (padroesAlta.length === 0) {
        toast.info('Nenhum padrão de alta confiança com pendentes.');
        return;
      }
      setAprovarTodosProgress({ current: 0, total: padroesAlta.length, aplicados: 0 });
      let totalAplicados = 0;
      for (let i = 0; i < padroesAlta.length; i += 1) {
        if (cancelarAprovarTodosRef.current) break;
        const p = padroesAlta[i];
        try {
          const r = await aplicarRecorrenciaApi({
            descricaoNorm: p.descricaoNorm,
            numeroBanco: p.numeroBanco,
            contaContabilId: p.contaContabilId,
            clienteId: p.clienteId ?? null,
            processoId: p.processoId ?? null,
            criarRegra: false,
            dryRun: false,
          });
          totalAplicados += Number(r?.aplicados ?? 0);
        } catch (e) {
          toast.warn(`Falha em ${p.descricaoExemplo}: ${e?.message || 'erro'}`);
        }
        setAprovarTodosProgress({ current: i + 1, total: padroesAlta.length, aplicados: totalAplicados });
      }
      toast.success(
        `${totalAplicados.toLocaleString('pt-BR')} lançamento${totalAplicados === 1 ? '' : 's'} classificado${totalAplicados === 1 ? '' : 's'} em lote`,
      );
      refreshAll();
    } finally {
      setAprovarTodosProgress(null);
    }
  }, [bancoAtivo, toast, refreshAll]);

  if (!featureFlags.useApiFinanceiro) {
    return (
      <div className="p-6 text-sm text-slate-600 dark:text-slate-400">API financeiro desativada.</div>
    );
  }

  if (headerLoading && !saude) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-0 h-full overflow-auto p-4 space-y-4 max-w-5xl">
      <header>
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Análises contábeis</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitulo}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">Confiança:</span>
        <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
          {[
            { id: 'ALTA', label: 'Alta' },
            { id: 'MEDIA', label: 'Média+' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setConfiancaMinima(id)}
              className={`text-xs px-3 py-1 ${
                confiancaMinima === id
                  ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200 font-medium'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              aria-pressed={confiancaMinima === id}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 ml-1">
          <input
            type="checkbox"
            checked={apenasComPendentes}
            onChange={(e) => setApenasComPendentes(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-600"
          />
          Só com pendentes
        </label>
        {bancoAtivo ? (
          <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
            Banco: <strong>{bancoNome}</strong> (sidebar)
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard
          label="Total lançamentos"
          value={totalLanc.toLocaleString('pt-BR')}
        />
        <KpiCard
          label="% classificado"
          value={`${pctClass}%`}
          tone="emerald"
        />
        <KpiCard label="Pendentes (N)" value={pendentes.toLocaleString('pt-BR')} tone="amber" />
        <KpiCard
          label="Classificáveis por recorrência"
          value={classificaveisRecorrencia.toLocaleString('pt-BR')}
          sublabel="nas recorrências detectadas"
          tone="emerald"
        />
      </div>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-3">
          Distribuição por conta (quantidade)
        </h3>
        <DistribuicaoBar totaisPorConta={totaisPorConta} />
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">Recorrências detectadas</h3>
          <span className="text-xs text-slate-500 tabular-nums">
            {totalElements.toLocaleString('pt-BR')} padrão{totalElements === 1 ? '' : 'ões'}
          </span>
        </div>

        {listaLoading && recorrencias.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando padrões…</div>
        ) : listaErro ? (
          <div className="p-4 text-sm text-red-600 dark:text-red-400">{listaErro}</div>
        ) : recorrencias.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum padrão recorrente encontrado com os filtros atuais.
            {confiancaMinima === 'ALTA' ? (
              <p className="mt-2 text-xs">Tente &quot;Média+&quot; ou confira se o backfill de descrição foi concluído.</p>
            ) : null}
          </div>
        ) : (
          <ul className="p-3 space-y-2">
            {recorrencias.map((p) => {
              const key = chavePadraoRecorrencia(p);
              return (
                <li key={key}>
                  <RecorrenciaCard
                    padrao={p}
                    fading={fadingKeys.has(key)}
                    busy={busyKey === key}
                    onClassificar={abrirDialog}
                    onRevisar={abrirDialog}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {totalElements > 0 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalElements}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(0);
            }}
          />
        ) : null}

        <footer className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80">
          {aprovarTodosProgress ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>
                  Aprovando {aprovarTodosProgress.current} de {aprovarTodosProgress.total}…
                </span>
                <span className="tabular-nums">
                  {aprovarTodosProgress.aplicados.toLocaleString('pt-BR')} classificados
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{
                    width: `${(aprovarTodosProgress.current / aprovarTodosProgress.total) * 100}%`,
                  }}
                />
              </div>
              <button
                type="button"
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
                onClick={() => {
                  cancelarAprovarTodosRef.current = true;
                }}
              >
                Cancelar após o lote atual
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={aprovarTodosAlta}
              disabled={confiancaMinima !== 'ALTA' || listaLoading}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
              aria-label="Aprovar todos os padrões de alta confiança"
              title={confiancaMinima !== 'ALTA' ? 'Disponível com filtro Confiança: Alta' : undefined}
            >
              Aprovar todos de alta confiança
            </button>
          )}
        </footer>
      </section>

      <AplicarRecorrenciaDialog
        open={Boolean(dialogPadrao)}
        padrao={dialogPadrao}
        dryRunResult={dryRunResult}
        loading={aplicando}
        criarRegra={criarRegra}
        onCriarRegraChange={setCriarRegra}
        onConfirm={confirmarAplicar}
        onCancel={() => !aplicando && setDialogPadrao(null)}
      />
    </div>
  );
}
