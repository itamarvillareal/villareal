import { useEffect, useState } from 'react';
import { Pencil, Search, Trash2, Wrench } from 'lucide-react';
import { useFinanceiroChrome, useFinanceiroFilters } from '../FinanceiroContext.jsx';
import { PeriodoSelector } from '../shared/PeriodoSelector.jsx';
import { isPeriodoTotal } from '../shared/periodoFinanceiro.js';
import { FilterTag } from '../shared/FilterTag.jsx';
import { EtapaFiltroSelect } from '../shared/EtapaFiltroSelect.jsx';
import { LimparContaDialog } from '../shared/LimparContaDialog.jsx';
import { SaldoInicialDialog } from '../shared/SaldoInicialDialog.jsx';
import { ExtratoRepararDialog } from './ExtratoRepararDialog.jsx';
import { formatDataCurta, formatMoeda } from '../shared/financeiroFormat.js';
import { FINANCEIRO_REFRESH_PENDENTES } from '../hooks/useKeyboardShortcuts.js';
import { LetrasFiltroExtrato } from './LetrasFiltroExtrato.jsx';
import {
  CADASTRO_PARCIAL,
  CADASTRO_PLENO,
  CADASTRO_TODOS,
  rotuloCadastroFiltro,
} from './extratoCadastroFiltro.js';

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
    setLetrasFiltro,
    setCadastroFiltro,
    setBusca,
    setSemClienteId,
    setSemGrupoCompensacao,
    setBanco,
  } = useFinanceiroFilters();
  const { bancoAtivo, bancos } = useFinanceiroChrome();

  const [buscaLocal, setBuscaLocal] = useState(filters.busca ?? '');
  const [limparOpen, setLimparOpen] = useState(false);
  const [saldoInicialOpen, setSaldoInicialOpen] = useState(false);
  const [repararOpen, setRepararOpen] = useState(false);

  useEffect(() => {
    setBuscaLocal(filters.busca ?? '');
  }, [filters.busca]);

  const bancoNome = bancos.find((b) => b.numero === bancoAtivo)?.nome;

  return (
    <>
    <div className="flex flex-col gap-2 px-2 py-2 sm:px-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodoSelector value={filters.mes} onChange={setMes} incluirTotal />
        <EtapaFiltroSelect value={filters.etapa ?? ''} onChange={(v) => setEtapa(v || null)} />
        {bancoAtivo && bancoNome ? <FilterTag label={bancoNome} onRemove={() => setBanco(null)} /> : null}
        {bancoAtivo ? (
          <div
            className="flex flex-wrap items-baseline gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 shrink-0 max-lg:w-full"
            title="Soma de todos os lançamentos desta conta no sistema."
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
      </div>

      <div className="hidden md:flex flex-wrap items-center gap-2">
        <LetrasFiltroExtrato
          letras={filters.letras ?? []}
          letrasModo={filters.letrasModo ?? 'incluir'}
          onChange={setLetrasFiltro}
        />
        <select
          value={filters.cadastro ?? CADASTRO_TODOS}
          onChange={(e) => setCadastroFiltro(e.target.value)}
          className={`text-xs px-2 py-0.5 rounded-md border shrink-0 ${
            filters.cadastro && filters.cadastro !== CADASTRO_TODOS
              ? 'border-violet-300 bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:border-violet-700 dark:text-violet-200'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900'
          }`}
          aria-label="Filtrar cadastro pleno ou parcial"
        >
          <option value={CADASTRO_TODOS}>{rotuloCadastroFiltro(CADASTRO_TODOS)}: todos</option>
          <option value={CADASTRO_PLENO}>{rotuloCadastroFiltro(CADASTRO_PLENO)}</option>
          <option value={CADASTRO_PARCIAL}>{rotuloCadastroFiltro(CADASTRO_PARCIAL)}</option>
        </select>
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
          <button
            type="button"
            onClick={() => setSaldoInicialOpen(true)}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
          >
            <Pencil className="w-3 h-3" aria-hidden />
            Saldo inicial
          </button>
        ) : null}
        {bancoAtivo && bancoNome ? (
          <button
            type="button"
            onClick={() => setRepararOpen(true)}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200 shrink-0"
          >
            <Wrench className="w-3 h-3" aria-hidden />
            Reparar
          </button>
        ) : null}
        {bancoAtivo && bancoNome ? (
          <button
            type="button"
            onClick={() => setLimparOpen(true)}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300 shrink-0"
          >
            <Trash2 className="w-3 h-3" aria-hidden />
            Limpar conta
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex flex-1 min-w-0 items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
          <input
            id="financeiro-campo-busca"
            type="search"
            value={buscaLocal}
            onChange={(e) => {
              const v = e.target.value;
              setBuscaLocal(v);
              setBusca(v);
            }}
            placeholder="Buscar na descrição ou valor..."
            className="flex-1 min-w-0 bg-transparent border-0 text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
            aria-label="Buscar na descrição ou valor"
          />
        </label>
        <span className="text-[11px] text-slate-400 tabular-nums shrink-0 text-right w-full sm:w-auto sm:ml-auto">
          {filters.busca?.trim() ? (
            <>
              {totalGeral.toLocaleString('pt-BR')} encontrado{totalGeral === 1 ? '' : 's'}{' '}
              {isPeriodoTotal(filters.mes) ? 'no total' : 'no período'}
            </>
          ) : (
            <>
              {totalNaPagina.toLocaleString('pt-BR')} de {totalGeral.toLocaleString('pt-BR')}
            </>
          )}
        </span>
      </div>
    </div>

    {bancoAtivo && bancoNome ? (
      <LimparContaDialog
        open={limparOpen}
        tipo="banco"
        nome={bancoNome}
        numero={bancoAtivo}
        onClose={() => setLimparOpen(false)}
      />
    ) : null}

    {bancoAtivo && bancoNome ? (
      <ExtratoRepararDialog
        open={repararOpen}
        bancoNome={bancoNome}
        numeroBanco={bancoAtivo}
        onClose={() => setRepararOpen(false)}
      />
    ) : null}

    {bancoAtivo && bancoNome ? (
      <SaldoInicialDialog
        open={saldoInicialOpen}
        numeroBanco={bancoAtivo}
        bancoNome={bancoNome}
        onClose={() => setSaldoInicialOpen(false)}
        onSaved={() => window.dispatchEvent(new CustomEvent(FINANCEIRO_REFRESH_PENDENTES))}
      />
    ) : null}
    </>
  );
}
