import { useEffect, useMemo, useState } from 'react';
import { Loader2, Printer, X } from 'lucide-react';
import { listarLancamentosExtratoPaginados } from '../../../repositories/financeiroRepository.js';
import { formatDataBrCompleta, formatMoeda, signedValorFromApi } from '../shared/financeiroFormat.js';

async function carregarExtratoCompleto(apiQuery, opts = {}) {
  const out = [];
  let page = 0;
  let totalPages = 1;
  const { page: _p, size: _s, ...filtrosBase } = apiQuery ?? {};
  while (page < totalPages && page < 200) {
    const res = await listarLancamentosExtratoPaginados(
      {
        ...filtrosBase,
        page,
        size: 500,
        sort: filtrosBase.sort || 'dataLancamento,asc',
      },
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
 * Pré-visualização para Imprimir / PDF do extrato (filtros atuais da grade).
 */
export function ExtratoImpressaoModal({ apiQuery, titulo, subtitulo, onClose }) {
  const [lancamentos, setLancamentos] = useState(null);
  const [erro, setErro] = useState('');
  const queryKey = useMemo(() => JSON.stringify(apiQuery ?? {}), [apiQuery]);

  useEffect(() => {
    const ac = new AbortController();
    setLancamentos(null);
    setErro('');
    let query;
    try {
      query = JSON.parse(queryKey);
    } catch {
      query = apiQuery;
    }
    carregarExtratoCompleto(query, { signal: ac.signal })
      .then((lista) => setLancamentos(lista))
      .catch((e) => {
        if (e?.name !== 'AbortError') setErro(e?.message || 'Falha ao carregar o extrato completo.');
      });
    return () => ac.abort();
    // queryKey estabiliza o fetch; apiQuery só como fallback de parse
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional
  }, [queryKey]);

  const linhas = useMemo(() => {
    if (!lancamentos) return [];
    let saldo = 0;
    return lancamentos.map((l) => {
      const valor = signedValorFromApi(l);
      saldo += valor;
      return { l, valor, saldo };
    });
  }, [lancamentos]);

  const saldoFinal = linhas.length ? linhas[linhas.length - 1].saldo : 0;

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 overflow-auto print:static print:overflow-visible print:bg-white">
      <div className="max-w-5xl mx-auto p-6 print:p-0 print:max-w-none">
        <div className="flex items-center justify-between gap-2 mb-4 print:hidden">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Pré-visualização — use Imprimir / PDF do navegador para salvar
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!lancamentos || linhas.length === 0}
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" /> Fechar
            </button>
          </div>
        </div>

        <header className="mb-3">
          <h1 className="text-base font-bold text-slate-900 dark:text-white print:text-black">
            {titulo || 'Extrato financeiro'}
          </h1>
          <p className="text-xs text-slate-500 print:text-black">
            {subtitulo ? `${subtitulo} · ` : ''}
            emitido em {new Date().toLocaleDateString('pt-BR')} ·{' '}
            {(lancamentos?.length ?? 0).toLocaleString('pt-BR')} lançamentos
          </p>
        </header>

        {erro ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 print:hidden">
            {erro}
          </p>
        ) : null}

        {!lancamentos && !erro ? (
          <p className="flex items-center gap-2 text-sm text-slate-500 py-10 justify-center print:hidden">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando extrato completo…
          </p>
        ) : null}

        {lancamentos ? (
          <table className="w-full text-xs print:text-[10px]">
            <thead className="text-left border-b-2 border-slate-300">
              <tr>
                <th className="px-1 py-1">Data</th>
                <th className="px-1 py-1">Conta</th>
                <th className="px-1 py-1">Descrição</th>
                <th className="px-1 py-1 text-right">Valor</th>
                <th className="px-1 py-1 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ l, valor, saldo }) => (
                <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800 print:border-slate-300">
                  <td className="px-1 py-0.5 whitespace-nowrap">{formatDataBrCompleta(l.dataLancamento)}</td>
                  <td className="px-1 py-0.5 whitespace-nowrap">{l.contaContabilNome || '—'}</td>
                  <td className="px-1 py-0.5">{l.descricao}</td>
                  <td
                    className={`px-1 py-0.5 text-right tabular-nums whitespace-nowrap ${
                      valor < 0 ? 'text-red-700 print:text-black' : 'text-emerald-700 print:text-black'
                    }`}
                  >
                    {formatMoeda(valor)}
                  </td>
                  <td className="px-1 py-0.5 text-right tabular-nums whitespace-nowrap">{formatMoeda(saldo)}</td>
                </tr>
              ))}
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-slate-500">
                    Nenhum lançamento neste filtro.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {linhas.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-slate-400 font-semibold">
                  <td colSpan={3} className="px-1 py-1.5 text-right">
                    Saldo do recorte
                  </td>
                  <td colSpan={2} className="px-1 py-1.5 text-right tabular-nums">
                    {formatMoeda(saldoFinal)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : null}
      </div>
    </div>
  );
}
