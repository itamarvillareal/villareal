import { useEffect, useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  listarCartoesFinanceiro,
  listarLancamentosCartaoFinanceiro,
} from '../../../repositories/financeiroRepository.js';
import { ExtratoSkeleton } from '../shared/LoadingSkeleton.jsx';
import { formatMoeda } from '../shared/financeiroFormat.js';
import {
  agruparFechamentosPorCartao,
  labelMesFechamento,
  linkExtratoFechamentos,
  mesclarCartoesComResumos,
  resumoTotalFechamentos,
} from './fechamentoFaturaResumo.js';

function ResumoTabela({ titulo, rows, labelChave, onRowClick }) {
  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden min-w-0">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-slate-500 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
        {titulo}
      </h4>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-xs text-slate-500">Nenhum fechamento.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] text-slate-500 border-b border-slate-100 dark:border-slate-800">
              <th className="text-left font-medium px-3 py-1.5">Período</th>
              <th className="text-right font-medium px-3 py-1.5">Qtd.</th>
              <th className="text-right font-medium px-3 py-1.5">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.chave}
                className="border-b border-slate-50 dark:border-slate-800/80 last:border-0 hover:bg-blue-50/60 dark:hover:bg-blue-950/20 cursor-pointer"
                onClick={() => onRowClick?.(row.chave)}
              >
                <td className="px-3 py-1.5 text-slate-800 dark:text-slate-200">{labelChave(row.chave)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                  {row.quantidade}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {formatMoeda(row.valor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ResumoCartao({ resumo, onNavigateExtrato }) {
  const { cartaoId, cartaoNome, total, porMes, porAno } = resumo;
  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 min-w-0">
          <CreditCard className="w-4 h-4 shrink-0 text-amber-600 opacity-80" aria-hidden />
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{cartaoNome}</h3>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatMoeda(total.valor)}
          </p>
          <p className="text-[11px] text-slate-500 tabular-nums">
            {total.quantidade} fechamento{total.quantidade === 1 ? '' : 's'}
            {total.quantidade > 0 ? (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => onNavigateExtrato({ cartaoId })}
                  className="text-blue-600 hover:underline"
                >
                  ver extrato
                </button>
              </>
            ) : null}
          </p>
        </div>
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-2">
        <ResumoTabela
          titulo="Por mês"
          rows={porMes}
          labelChave={labelMesFechamento}
          onRowClick={(chave) => onNavigateExtrato({ cartaoId, mes: chave })}
        />
        <ResumoTabela
          titulo="Por ano"
          rows={porAno}
          labelChave={(chave) => chave}
          onRowClick={(chave) => onNavigateExtrato({ cartaoId, ano: chave })}
        />
      </div>
    </section>
  );
}

/** Resumo de fechamentos AUTO-FAT — individualizado por cartão. */
export function CartoesHubPage() {
  const navigate = useNavigate();
  const [lancamentos, setLancamentos] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) {
      setLancamentos([]);
      setCartoes([]);
      return undefined;
    }
    const ac = new AbortController();
    setLoading(true);
    setErro('');
    Promise.all([
      listarLancamentosCartaoFinanceiro({ fechamentoAutomatico: true }, { signal: ac.signal }),
      listarCartoesFinanceiro({ signal: ac.signal }),
    ])
      .then(([lista, cartoesApi]) => {
        setLancamentos(Array.isArray(lista) ? lista : []);
        setCartoes(Array.isArray(cartoesApi) ? cartoesApi : []);
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setErro(e?.message || 'Erro ao carregar fechamentos.');
        setLancamentos([]);
        setCartoes([]);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, []);

  const resumosPorCartao = useMemo(() => {
    const resumos = agruparFechamentosPorCartao(lancamentos);
    return mesclarCartoesComResumos(resumos, cartoes);
  }, [lancamentos, cartoes]);

  const totalGeral = useMemo(() => resumoTotalFechamentos(lancamentos), [lancamentos]);

  const onNavigateExtrato = (filtros) => navigate(linkExtratoFechamentos(filtros));

  if (!featureFlags.useApiFinanceiro) {
    return <p className="p-4 text-sm text-slate-600">API financeiro desativada.</p>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full bg-white dark:bg-slate-900 overflow-auto">
      <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Cartões</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Fechamentos automáticos de fatura (AUTO-FAT) — resumo por cartão
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <Link to="/financeiro/cartoes/fechamentos" className="text-blue-600 hover:underline">
              Ver extrato detalhado
            </Link>
            <Link to="/financeiro/cartoes/regras" className="text-blue-600 hover:underline">
              Regras e vínculos
            </Link>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-6xl">
        {erro ? <p className="text-sm text-red-600">{erro}</p> : null}

        {loading ? (
          <ExtratoSkeleton />
        ) : (
          <>
            <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Total geral</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoeda(totalGeral.valor)}
              </p>
              <p className="text-xs text-slate-500 mt-1 tabular-nums">
                {totalGeral.quantidade} fechamento{totalGeral.quantidade === 1 ? '' : 's'}
                {' · '}
                {resumosPorCartao.length} cartão{resumosPorCartao.length === 1 ? '' : 'ões'}
                {' · '}
                <button
                  type="button"
                  onClick={() => onNavigateExtrato()}
                  className="text-blue-600 hover:underline"
                >
                  ver lista completa
                </button>
              </p>
            </section>

            <div className="space-y-4">
              {resumosPorCartao.map((resumo) => (
                <ResumoCartao
                  key={resumo.cartaoId ?? resumo.cartaoNome}
                  resumo={resumo}
                  onNavigateExtrato={onNavigateExtrato}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
