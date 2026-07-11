import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, Printer, RefreshCw } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  listarContasBancariasClassificacaoApi,
  listarLancamentosFinanceiroPaginados,
  obterContaAcertoResumoApi,
} from '../../../repositories/financeiroRepository.js';
import { formatMoeda } from '../shared/financeiroFormat.js';

function fmtData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? '');
}

/** Valor assinado do lançamento na visão pedida (cliente usa valorCliente quando preenchido). */
function valorAssinado(l, visaoCliente) {
  const bruto =
    visaoCliente && l.valorCliente != null ? Number(l.valorCliente) : Math.abs(Number(l.valor ?? 0));
  return String(l.natureza ?? '').toUpperCase() === 'DEBITO' ? -bruto : bruto;
}

function refExibicao(l) {
  const grupo = String(l.grupoCompensacao ?? '').trim();
  const ni = l.numeroInternoProcesso;
  if (ni != null && ni !== '') return String(ni);
  if (l.processoId != null) return String(l.processoId);
  return grupo || '0';
}

async function carregarTodosLancamentos({ numeroBanco, clienteId }, opts = {}) {
  const out = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages && page < 100) {
    const res = await listarLancamentosFinanceiroPaginados(
      { numeroBanco, clienteId, page, size: 200, sort: 'dataLancamento,asc' },
      opts,
    );
    out.push(...(res?.content ?? []));
    totalPages = Math.max(1, Number(res?.totalPages) || 1);
    page += 1;
    if (!res?.content?.length) break;
  }
  return out;
}

/**
 * Relatório "Acerto do Cliente" da conta de acerto (CONTA ZERO), no formato do PDF de referência:
 * lançamentos em ordem cronológica com saldo acumulado. Visão do cliente filtra
 * visivel_cliente = true e usa valor_cliente quando preenchido; visão interna mostra tudo.
 */
export function AcertoContaZeroPage() {
  const [contasAcerto, setContasAcerto] = useState([]);
  const [numeroBanco, setNumeroBanco] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [vinculoSel, setVinculoSel] = useState(null);
  const [lancamentos, setLancamentos] = useState([]);
  const [visaoCliente, setVisaoCliente] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    listarContasBancariasClassificacaoApi({ signal: ac.signal })
      .then((lista) => {
        const acertos = (Array.isArray(lista) ? lista : []).filter((c) => c?.exigeSomaZero === true);
        setContasAcerto(acertos);
        setNumeroBanco((atual) => atual ?? (acertos[0]?.numeroBanco != null ? Number(acertos[0].numeroBanco) : 19));
      })
      .catch(() => setNumeroBanco((atual) => atual ?? 19));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || numeroBanco == null) return undefined;
    const ac = new AbortController();
    obterContaAcertoResumoApi(numeroBanco, { signal: ac.signal })
      .then((r) => setResumo(r ?? null))
      .catch((e) => {
        if (e?.name !== 'AbortError') setResumo(null);
      });
    return () => ac.abort();
  }, [numeroBanco, refreshKey]);

  useEffect(() => {
    const clienteId = vinculoSel?.clienteId;
    if (!featureFlags.useApiFinanceiro || numeroBanco == null || !clienteId) {
      setLancamentos([]);
      return undefined;
    }
    const ac = new AbortController();
    setCarregando(true);
    setErro('');
    carregarTodosLancamentos({ numeroBanco, clienteId: Number(clienteId) }, { signal: ac.signal })
      .then((lista) => setLancamentos(lista))
      .catch((e) => {
        if (e?.name !== 'AbortError') {
          setErro(e?.message || 'Falha ao carregar lançamentos.');
          setLancamentos([]);
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setCarregando(false);
      });
    return () => ac.abort();
  }, [numeroBanco, vinculoSel?.clienteId, refreshKey]);

  const linhas = useMemo(() => {
    const filtrados = visaoCliente
      ? lancamentos.filter((l) => l.visivelCliente !== false)
      : lancamentos;
    let saldo = 0;
    return filtrados.map((l) => {
      const v = valorAssinado(l, visaoCliente);
      saldo += v;
      return { l, valor: v, saldo };
    });
  }, [lancamentos, visaoCliente]);

  const saldoFinal = linhas.length ? linhas[linhas.length - 1].saldo : 0;
  const pendentes = useMemo(
    () => lancamentos.filter((l) => String(l.grupoCompensacao ?? '').trim() === '').length,
    [lancamentos],
  );

  const selecionarVinculo = useCallback((v) => setVinculoSel(v), []);

  if (!featureFlags.useApiFinanceiro) {
    return <div className="p-6 text-sm text-slate-600 dark:text-slate-400">API financeiro desativada.</div>;
  }

  const vinculos = resumo?.vinculos ?? [];
  const nomeConta =
    contasAcerto.find((c) => Number(c.numeroBanco) === Number(numeroBanco))?.bancoNome || 'CONTA ZERO';

  return (
    <div className="flex flex-col min-h-0 h-full overflow-auto p-4 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Acerto do Cliente</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {nomeConta} (conta {numeroBanco ?? '—'}) — extrato de acerto por cliente, com saldo acumulado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {contasAcerto.length > 1 ? (
            <select
              value={numeroBanco ?? ''}
              onChange={(e) => {
                setNumeroBanco(Number(e.target.value));
                setVinculoSel(null);
              }}
              className="text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
            >
              {contasAcerto.map((c) => (
                <option key={c.numeroBanco} value={c.numeroBanco}>
                  {c.bancoNome} ({c.numeroBanco})
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => setVisaoCliente((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            title={
              visaoCliente
                ? 'Visão do cliente: oculta lançamentos internos e usa o valor para o cliente'
                : 'Visão interna: todos os lançamentos com valores reais'
            }
          >
            {visaoCliente ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {visaoCliente ? 'Visão do cliente' : 'Visão interna'}
          </button>
          <button
            type="button"
            onClick={() => setRefreshKey((n) => n + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button
            type="button"
            disabled={!vinculoSel || linhas.length === 0}
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Imprimir / PDF
          </button>
        </div>
      </header>

      {erro ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 print:hidden">
          {erro}
        </p>
      ) : null}

      <div className="flex flex-col lg:flex-row gap-4 min-h-0">
        <aside className="lg:w-80 shrink-0 print:hidden">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <p className="px-3 py-2 text-xs font-medium text-slate-500 border-b border-slate-100 dark:border-slate-800">
              Clientes com movimento na conta
            </p>
            {vinculos.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500">Nenhum vínculo com lançamentos.</p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {vinculos.map((v) => {
                  const chave = v.clienteId != null ? `cli-${v.clienteId}` : `pes-${v.pessoaRefId}`;
                  const ativo =
                    vinculoSel &&
                    ((v.clienteId != null && Number(vinculoSel.clienteId) === Number(v.clienteId)) ||
                      (v.clienteId == null && Number(vinculoSel.pessoaRefId) === Number(v.pessoaRefId)));
                  const pendente = Math.abs(Number(v.saldoPendente ?? 0)) >= 0.005 || Number(v.pendentes) > 0;
                  return (
                    <li key={chave}>
                      <button
                        type="button"
                        disabled={v.clienteId == null}
                        onClick={() => selecionarVinculo(v)}
                        title={v.clienteId == null ? 'Vínculo por pessoa/imóvel — use o extrato interno' : undefined}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-950/30 disabled:opacity-60 ${
                          ativo ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''
                        }`}
                      >
                        <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                          {String(v.nome ?? '').trim() ||
                            (v.codigoCliente ? `Cliente ${v.codigoCliente}` : `Pessoa ${v.pessoaRefId}`)}
                        </p>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          {Number(v.totalLancamentos).toLocaleString('pt-BR')} lanç. · saldo{' '}
                          {formatMoeda(Number(v.saldo ?? 0))}
                          {pendente ? (
                            <span className="ml-1 text-amber-700 dark:text-amber-300">
                              · {Number(v.pendentes).toLocaleString('pt-BR')} pend. ({formatMoeda(Number(v.saldoPendente ?? 0))})
                            </span>
                          ) : null}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {!vinculoSel ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Selecione um cliente para gerar o acerto.
            </p>
          ) : carregando ? (
            <p className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando lançamentos…
            </p>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden print:border-0 print:rounded-none">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Acerto — {vinculoSel.nome}
                  {vinculoSel.codigoCliente ? ` (${vinculoSel.codigoCliente})` : ''}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {nomeConta} · {visaoCliente ? 'visão do cliente' : 'visão interna'} ·{' '}
                  {linhas.length.toLocaleString('pt-BR')} lançamentos
                  {pendentes > 0 ? ` · ${pendentes.toLocaleString('pt-BR')} pendentes de compensação` : ''}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-left">
                    <tr>
                      <th className="px-2 py-1.5">Nº</th>
                      <th className="px-2 py-1.5">Data</th>
                      <th className="px-2 py-1.5">Ref</th>
                      <th className="px-2 py-1.5">Descrição</th>
                      {!visaoCliente ? <th className="px-2 py-1.5">Grupo</th> : null}
                      {!visaoCliente ? <th className="px-2 py-1.5 text-center">Cliente vê</th> : null}
                      <th className="px-2 py-1.5 text-right">Valor</th>
                      <th className="px-2 py-1.5 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map(({ l, valor, saldo }) => (
                      <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-2 py-1 font-mono text-[10px] whitespace-nowrap">
                          {l.numeroLancamento || l.id}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">{fmtData(l.dataLancamento)}</td>
                        <td className="px-2 py-1 whitespace-nowrap">{refExibicao(l)}</td>
                        <td className="px-2 py-1 max-w-[320px]">
                          <span className="block truncate" title={l.descricao}>
                            {l.descricao}
                          </span>
                          {String(l.descricaoDetalhada ?? '').trim() ? (
                            <span
                              className="block truncate text-[10px] text-slate-400"
                              title={l.descricaoDetalhada}
                            >
                              {l.descricaoDetalhada}
                            </span>
                          ) : null}
                        </td>
                        {!visaoCliente ? (
                          <td className="px-2 py-1 font-mono text-[10px]">
                            {String(l.grupoCompensacao ?? '').trim() || (
                              <span className="text-amber-700 dark:text-amber-300">pendente</span>
                            )}
                          </td>
                        ) : null}
                        {!visaoCliente ? (
                          <td className="px-2 py-1 text-center">
                            {l.visivelCliente === false
                              ? 'não'
                              : l.valorCliente != null
                                ? `sim (${formatMoeda(Number(l.valorCliente))})`
                                : 'sim'}
                          </td>
                        ) : null}
                        <td
                          className={`px-2 py-1 text-right tabular-nums font-medium ${
                            valor < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {formatMoeda(valor)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatMoeda(saldo)}</td>
                      </tr>
                    ))}
                    {linhas.length === 0 ? (
                      <tr>
                        <td colSpan={visaoCliente ? 6 : 8} className="px-4 py-8 text-center text-slate-500">
                          Nenhum lançamento nesta visão.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  {linhas.length > 0 ? (
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 font-semibold">
                        <td colSpan={visaoCliente ? 4 : 6} className="px-2 py-2 text-right">
                          Saldo final do acerto
                        </td>
                        <td colSpan={2} className="px-2 py-2 text-right tabular-nums">
                          {formatMoeda(saldoFinal)}
                          <span className="block text-[10px] font-normal text-slate-500">
                            {Math.abs(saldoFinal) < 0.005
                              ? 'acerto zerado'
                              : saldoFinal > 0
                                ? 'a favor do escritório'
                                : 'a favor do cliente'}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
