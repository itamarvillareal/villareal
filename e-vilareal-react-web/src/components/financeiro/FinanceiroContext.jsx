import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CARTAO_TO_NUMERO, compararOrdemExibicaoBancos, getBancoNumeroMapMerged } from '../../data/financeiroData.js';
import {
  buildClassificacaoContasPorNumero,
  classificacaoConta,
  contaTemExtrato as contaTemExtratoFn,
  isContaManual as isContaManualFn,
  isContaVirtual as isContaVirtualFn,
} from '../../data/contaBancariaClassificacao.js';
import { listarContasBancariasClassificacaoApi } from '../../repositories/financeiroRepository.js';
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
  // B4: classificação (tipo/tem_extrato) vinda do endpoint, buscada uma vez e cacheada.
  // Enquanto carrega/falha, os helpers caem no fallback hardcoded (transição; sai na Fase C).
  const [contasClassificacaoApi, setContasClassificacaoApi] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    listarContasBancariasClassificacaoApi({ signal: controller.signal })
      .then((lista) => setContasClassificacaoApi(Array.isArray(lista) ? lista : []))
      .catch(() => {
        // falha/abort: mantém null → helpers usam o fallback hardcoded; a tela não quebra.
      });
    return () => controller.abort();
  }, [bancosRevision]);

  const classificacaoPorNumero = useMemo(
    () => buildClassificacaoContasPorNumero(contasClassificacaoApi),
    [contasClassificacaoApi],
  );

  const isContaManual = useCallback(
    (numero) => isContaManualFn(numero, classificacaoPorNumero),
    [classificacaoPorNumero],
  );
  const isContaVirtual = useCallback(
    (numero) => isContaVirtualFn(numero, classificacaoPorNumero),
    [classificacaoPorNumero],
  );
  const contaTemExtrato = useCallback(
    (numero) => contaTemExtratoFn(numero, classificacaoPorNumero),
    [classificacaoPorNumero],
  );

  const bancos = useMemo(() => {
    const map = getBancoNumeroMapMerged();
    return Object.entries(map)
      .map(([nome, numero]) => {
        const cls = classificacaoConta(numero, classificacaoPorNumero);
        return {
          nome,
          numero,
          count: contadores[numero] ?? contadores[nome] ?? null,
          tipo: cls.tipo,
          temExtrato: cls.temExtrato,
        };
      })
      .sort(compararOrdemExibicaoBancos);
  }, [contadores, bancosRevision, classificacaoPorNumero]);

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
      setConfianca: extratoFilters.setConfianca,
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
      extratoFilters.setConfianca,
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
      classificacaoPorNumero,
      isContaManual,
      isContaVirtual,
      contaTemExtrato,
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
      classificacaoPorNumero,
      isContaManual,
      isContaVirtual,
      contaTemExtrato,
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
