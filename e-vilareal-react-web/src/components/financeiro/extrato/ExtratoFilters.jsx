import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useFinanceiro } from '../FinanceiroContext.jsx';
import { PeriodoSelector } from '../shared/PeriodoSelector.jsx';
import { FilterTag } from '../shared/FilterTag.jsx';
import { formatDataCurta, formatMoeda } from '../shared/financeiroFormat.js';
import { ETAPAS, nomeContaPorLetra } from '../constants/financeiroConstants.js';

export function ExtratoFilters({
  totalNaPagina = 0,
  totalGeral = 0,
  saldoBanco = null,
  saldoBancoLoading = false,
}) {
  const {
    filters,
    setMes,
    setEtapa,
    setContaCodigo,
    setBusca,
    setSemClienteId,
    setSemGrupoCompensacao,
    setBanco,
    bancoAtivo,
    bancos,
  } = useFinanceiro();

  const [buscaLocal, setBuscaLocal] = useState(filters.busca ?? '');

  useEffect(() => {
    setBuscaLocal(filters.busca ?? '');
  }, [filters.busca]);

  const bancoNome = bancos.find((b) => b.numero === bancoAtivo)?.nome;

  const togglePendentes = () => {
    if (filters.etapa === ETAPAS.IMPORTADO) {
      setEtapa(null);
    } else {
      setEtapa(ETAPAS.IMPORTADO);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 min-h-11"
    >
      <PeriodoSelector value={filters.mes} onChange={setMes} />

      {filters.etapa === ETAPAS.IMPORTADO ? (
        <FilterTag
          label="Pendentes"
          onRemove={() => setEtapa(null)}
          style={{
            background: 'var(--fin-etapa-importado-bg)',
            borderColor: 'var(--fin-etapa-importado)',
            color: 'var(--fin-etapa-importado)',
          }}
        />
      ) : (
        <button
          type="button"
          onClick={togglePendentes}
          className="text-xs px-2 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200"
        >
          Pendentes
        </button>
      )}

      {filters.contaCodigo ? (
        <FilterTag
          label={`Conta: ${filters.contaCodigo}`}
          contaCodigo={filters.contaCodigo}
          onRemove={() => setContaCodigo(null)}
          title={nomeContaPorLetra(filters.contaCodigo)}
        />
      ) : null}

      {filters.semClienteId ? (
        <FilterTag label="Sem cliente" onRemove={() => setSemClienteId(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setSemClienteId(true)}
          className="text-xs px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Sem cliente
        </button>
      )}

      {filters.semGrupoCompensacao ? (
        <FilterTag label="Sem grupo" onRemove={() => setSemGrupoCompensacao(false)} />
      ) : null}

      {bancoAtivo && bancoNome ? (
        <FilterTag label={bancoNome} onRemove={() => setBanco(null)} />
      ) : null}

      {bancoAtivo ? (
        <div
          className="flex items-baseline gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 shrink-0"
          title="Soma de todos os lançamentos desta conta no sistema. Após importar o extrato completo, deve coincidir com o saldo exibido pelo banco."
        >
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Saldo</span>
          {saldoBancoLoading ? (
            <span className="text-xs text-slate-400">…</span>
          ) : (
            <>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  Number(saldoBanco?.saldo) < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {formatMoeda(saldoBanco?.saldo)}
              </span>
              {saldoBanco?.dataUltimoLancamento ? (
                <span className="text-[10px] text-slate-400 tabular-nums">
                  em {formatDataCurta(saldoBanco.dataUltimoLancamento)}
                </span>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <label className="flex flex-1 min-w-[120px] items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
        <input
          id="financeiro-campo-busca"
          type="search"
          value={buscaLocal}
            onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar na descrição..."
          className="flex-1 min-w-0 bg-transparent border-0 text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
          aria-label="Buscar na descrição"
        />
      </label>

      <span className="text-[11px] text-slate-400 tabular-nums shrink-0 ml-auto">
        {totalNaPagina.toLocaleString('pt-BR')} de {totalGeral.toLocaleString('pt-BR')}
      </span>
    </div>
  );
}

