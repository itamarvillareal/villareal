import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { featureFlags } from '../../../config/featureFlags.js';
import { competenciaAtual } from '../../../data/imoveisReconciliacao.js';
import { carregarVisaoGeralImoveisApi } from '../../../repositories/imoveisRepository.js';

const ImoveisCentralContext = createContext(null);

/**
 * Estado compartilhado da Central de Imóveis: competência selecionada e
 * visão geral do portfólio (uma chamada ao backend, compartilhada pelas telas).
 */
export function ImoveisCentralProvider({ children }) {
  const [competencia, setCompetencia] = useState(() => competenciaAtual());
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [ultimaCarga, setUltimaCarga] = useState(null);
  const [tick, setTick] = useState(0);

  const recarregar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!featureFlags.useApiImoveis) {
      setErro('Ative VITE_USE_API_IMOVEIS para carregar a Central de Imóveis.');
      return undefined;
    }
    const ac = new AbortController();
    let ativo = true;
    setCarregando(true);
    setErro('');
    carregarVisaoGeralImoveisApi({ competencia, signal: ac.signal })
      .then((r) => {
        if (!ativo) return;
        if (!r.ok) {
          setErro(r.motivo || 'Falha ao carregar a visão geral.');
          setItens([]);
          return;
        }
        setItens(r.itens);
        setUltimaCarga(new Date());
      })
      .catch((e) => {
        if (!ativo || e?.name === 'AbortError') return;
        setErro(e?.message || 'Falha ao carregar a visão geral.');
        setItens([]);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
      ac.abort();
    };
  }, [competencia, tick]);

  const porNumeroPlanilha = useMemo(() => {
    const map = new Map();
    for (const it of itens) {
      if (it?.numeroPlanilha != null) map.set(Number(it.numeroPlanilha), it);
    }
    return map;
  }, [itens]);

  const value = useMemo(
    () => ({
      competencia,
      setCompetencia,
      itens,
      porNumeroPlanilha,
      carregando,
      erro,
      ultimaCarga,
      recarregar,
      // Incrementa a cada recarregar(): permite que telas com fetch próprio se atualizem juntas.
      versaoRecarga: tick,
    }),
    [competencia, itens, porNumeroPlanilha, carregando, erro, ultimaCarga, recarregar, tick],
  );

  return <ImoveisCentralContext.Provider value={value}>{children}</ImoveisCentralContext.Provider>;
}

export function useImoveisCentral() {
  const ctx = useContext(ImoveisCentralContext);
  if (!ctx) {
    throw new Error('useImoveisCentral deve ser usado dentro de ImoveisCentralProvider.');
  }
  return ctx;
}
