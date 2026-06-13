import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CARTAO_TO_NUMERO, getBancoNumeroMapMerged } from '../../data/financeiroData.js';
import { useExtratoFilters } from './hooks/useExtratoFilters.js';

const FinanceiroFiltersContext = createContext(null);
const FinanceiroChromeContext = createContext(null);

const TOP_BANCOS_VISIVEIS = 5;

export function FinanceiroProvider({
  children,
  contadores = {},
  totalPendentes = 0,
  bancosRevision = 0,
  refreshBancos,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const extratoFilters = useExtratoFilters();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bancosExpandidos, setBancosExpandidos] = useState(false);

  const bancos = useMemo(() => {
    const map = getBancoNumeroMapMerged();
    return Object.entries(map)
      .map(([nome, numero]) => ({
        nome,
        numero,
        count: contadores[numero] ?? contadores[nome] ?? null,
      }))
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  }, [contadores, bancosRevision]);

  const bancosVisiveis = useMemo(() => {
    if (bancosExpandidos || bancos.length <= TOP_BANCOS_VISIVEIS + 1) return bancos;
    return bancos.slice(0, TOP_BANCOS_VISIVEIS);
  }, [bancos, bancosExpandidos]);

  const cartoes = useMemo(
    () => Object.entries(CARTAO_TO_NUMERO).map(([nome, numero]) => ({ nome, numero })),
    [],
  );

  const selecionarBanco = useCallback(
    (numero) => {
      extratoFilters.setBanco(numero);
      const path = location.pathname.replace(/\/$/, '');
      if (path === '/financeiro') {
        navigate('/financeiro/extrato');
      }
    },
    [extratoFilters.setBanco, navigate, location.pathname],
  );

  const filtersValue = useMemo(
    () => ({
      filters: extratoFilters.filters,
      apiQuery: extratoFilters.apiQuery,
      setBanco: extratoFilters.setBanco,
      setMes: extratoFilters.setMes,
      setTipoPar: extratoFilters.setTipoPar,
      setTipoDia: extratoFilters.setTipoDia,
      setLetraSugestao: extratoFilters.setLetraSugestao,
      setEtapa: extratoFilters.setEtapa,
      setContaCodigo: extratoFilters.setContaCodigo,
      setLetrasFiltro: extratoFilters.setLetrasFiltro,
      setCadastroFiltro: extratoFilters.setCadastroFiltro,
      setBusca: extratoFilters.setBusca,
      setSemClienteId: extratoFilters.setSemClienteId,
      setSemGrupoCompensacao: extratoFilters.setSemGrupoCompensacao,
      setPage: extratoFilters.setPage,
      setSize: extratoFilters.setSize,
      setSort: extratoFilters.setSort,
      toggleSortData: extratoFilters.toggleSortData,
      clearFilters: extratoFilters.clearFilters,
    }),
    [
      extratoFilters.filters,
      extratoFilters.apiQuery,
      extratoFilters.setBanco,
      extratoFilters.setMes,
      extratoFilters.setTipoPar,
      extratoFilters.setTipoDia,
      extratoFilters.setLetraSugestao,
      extratoFilters.setEtapa,
      extratoFilters.setContaCodigo,
      extratoFilters.setLetrasFiltro,
      extratoFilters.setCadastroFiltro,
      extratoFilters.setBusca,
      extratoFilters.setSemClienteId,
      extratoFilters.setSemGrupoCompensacao,
      extratoFilters.setPage,
      extratoFilters.setSize,
      extratoFilters.setSort,
      extratoFilters.toggleSortData,
      extratoFilters.clearFilters,
    ],
  );

  const chromeValue = useMemo(
    () => ({
      totalPendentes,
      contadores,
      bancos,
      bancosVisiveis,
      bancosRestantes: Math.max(0, bancos.length - TOP_BANCOS_VISIVEIS),
      cartoes,
      bancoAtivo: Number.isFinite(extratoFilters.filters.banco) ? extratoFilters.filters.banco : null,
      mesAtivo: extratoFilters.filters.mes,
      sidebarCollapsed,
      setSidebarCollapsed,
      bancosExpandidos,
      setBancosExpandidos,
      selecionarBanco,
      refreshBancos,
    }),
    [
      totalPendentes,
      contadores,
      bancos,
      bancosVisiveis,
      cartoes,
      extratoFilters.filters.banco,
      extratoFilters.filters.mes,
      sidebarCollapsed,
      bancosExpandidos,
      selecionarBanco,
      refreshBancos,
    ],
  );

  return (
    <FinanceiroChromeContext.Provider value={chromeValue}>
      <FinanceiroFiltersContext.Provider value={filtersValue}>{children}</FinanceiroFiltersContext.Provider>
    </FinanceiroChromeContext.Provider>
  );
}

export function useFinanceiroFilters() {
  const ctx = useContext(FinanceiroFiltersContext);
  if (!ctx) throw new Error('useFinanceiroFilters deve ser usado dentro de FinanceiroProvider');
  return ctx;
}

export function useFinanceiroChrome() {
  const ctx = useContext(FinanceiroChromeContext);
  if (!ctx) throw new Error('useFinanceiroChrome deve ser usado dentro de FinanceiroProvider');
  return ctx;
}

/** Compatibilidade: combina filtros + chrome (re-renderiza se qualquer um mudar). */
export function useFinanceiro() {
  return { ...useFinanceiroFilters(), ...useFinanceiroChrome() };
}
