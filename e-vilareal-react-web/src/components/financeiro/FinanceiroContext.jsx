import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CARTAO_TO_NUMERO, getBancoNumeroMapMerged } from '../../data/financeiroData.js';
import { useExtratoFilters } from './hooks/useExtratoFilters.js';

const FinanceiroContext = createContext(null);

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
  const {
    filters,
    apiQuery,
    setBanco,
    setMes,
    setEtapa,
    setContaCodigo,
    setBusca,
    setSemClienteId,
    setSemGrupoCompensacao,
    setPage,
    setSize,
    clearFilters,
  } = useExtratoFilters();
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
      setBanco(numero);
      const path = location.pathname.replace(/\/$/, '');
      if (path === '/financeiro') {
        navigate('/financeiro/extrato');
      }
    },
    [setBanco, navigate, location.pathname],
  );

  const value = useMemo(
    () => ({
      filters,
      apiQuery,
      setBanco,
      setMes,
      setEtapa,
      setContaCodigo,
      setBusca,
      setSemClienteId,
      setSemGrupoCompensacao,
      setPage,
      setSize,
      clearFilters,
      totalPendentes,
      contadores,
      bancos,
      bancosVisiveis,
      bancosRestantes: Math.max(0, bancos.length - TOP_BANCOS_VISIVEIS),
      cartoes,
      bancoAtivo: Number.isFinite(filters.banco) ? filters.banco : null,
      mesAtivo: filters.mes,
      sidebarCollapsed,
      setSidebarCollapsed,
      bancosExpandidos,
      setBancosExpandidos,
      selecionarBanco,
      refreshBancos,
    }),
    [
      filters,
      apiQuery,
      setBanco,
      setMes,
      setEtapa,
      setContaCodigo,
      setBusca,
      setSemClienteId,
      setSemGrupoCompensacao,
      setPage,
      setSize,
      clearFilters,
      totalPendentes,
      contadores,
      bancos,
      bancosVisiveis,
      cartoes,
      sidebarCollapsed,
      bancosExpandidos,
      selecionarBanco,
      refreshBancos,
    ],
  );

  return <FinanceiroContext.Provider value={value}>{children}</FinanceiroContext.Provider>;
}

export function useFinanceiro() {
  const ctx = useContext(FinanceiroContext);
  if (!ctx) throw new Error('useFinanceiro deve ser usado dentro de FinanceiroProvider');
  return ctx;
}
