import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Landmark,
  FolderOpen,
  CircleDollarSign,
  AlertTriangle,
} from 'lucide-react';
import { padCliente } from '../data/processosDadosRelatorio.js';
import { gerarAlertasAdministracaoImovel } from '../data/imoveisAdministracaoFinanceiro.js';
import { contarPendenciasMatriz, itemMatrizPorCompetencia } from '../data/imoveisAluguelChecklist.js';
import {
  carregarPainelAdministracaoImovel,
  desvincularReconciliacaoApi,
  gerarRepassesInternosApi,
  listarVinculosReconciliacaoApi,
  obterMatrizCompetenciasApi,
  obterResultadoImovelApi,
  vincularReconciliacaoApi,
} from '../repositories/imoveisRepository.js';
import {
  competenciaAtual,
  competenciaValida,
  repasseEsperado,
  statusRepasseInfo,
} from '../data/imoveisReconciliacao.js';
import { featureFlags } from '../config/featureFlags.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';
import { ImoveisAluguelChecklist } from './imoveis/ImoveisAluguelChecklist.jsx';
import { ImoveisContaCorrenteTrabalho } from './imoveis/ImoveisContaCorrenteTrabalho.jsx';
import { ImoveisPendenciasAluguel } from './imoveis/ImoveisPendenciasAluguel.jsx';

function formatBRL(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function corValorNegativo(n) {
  return Number(n) < 0 ? 'text-red-600!' : '';
}

const KPI_TONS = {
  emerald: 'text-emerald-800',
  slate: 'text-slate-800',
  orange: 'text-orange-800',
  teal: 'text-teal-800',
  indigo: 'text-indigo-800',
};

function mergeVinculosRespostaApi(vinculosAtuais, respostaApi) {
  const map = new Map(
    (vinculosAtuais || []).map((v) => [Number(v.lancamentoFinanceiroId), v]),
  );
  for (const n of respostaApi || []) {
    const lid = Number(n.lancamentoFinanceiroId);
    if (!Number.isFinite(lid)) continue;
    map.set(lid, {
      ...n,
      id: n.id,
      lancamentoFinanceiroId: lid,
      papel: n.papel,
      competenciaMes: n.competenciaMes,
      rotuloClassificacao: n.rotuloClassificacao ?? null,
    });
  }
  return [...map.values()];
}

function KpiResultado({ titulo, valor, sub, tom = 'slate' }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${KPI_TONS[tom] || KPI_TONS.slate}`}>{valor}</p>
      {sub ? <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p> : null}
    </div>
  );
}

function SecaoColapsavel({ titulo, subtitulo, aberto, onToggle, children }) {
  return (
    <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50/80"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
          {subtitulo ? <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p> : null}
        </div>
        {aberto ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
        )}
      </button>
      {aberto ? <div className="px-4 pb-4 border-t border-slate-100">{children}</div> : null}
    </div>
  );
}

export function ImoveisAdministracaoFinanceiro() {
  const navigate = useNavigate();
  const location = useLocation();
  const [refreshTick, setRefreshTick] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [imovelUi, setImovelUi] = useState(null);
  const [painelApi, setPainelApi] = useState(null);
  const [contratoVigenteApi, setContratoVigenteApi] = useState(null);

  const [competencia, setCompetencia] = useState(() => competenciaAtual());
  const [matriz, setMatriz] = useState(null);
  const [vinculosContrato, setVinculosContrato] = useState([]);
  const [carregandoMatriz, setCarregandoMatriz] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [salvandoReconc, setSalvandoReconc] = useState(false);
  const [gerandoRepasses, setGerandoRepasses] = useState(false);
  const [erroReconc, setErroReconc] = useState('');
  const [reconcTick, setReconcTick] = useState(0);
  const [resultadoAberto, setResultadoAberto] = useState(false);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [alertasAbertos, setAlertasAbertos] = useState(false);
  const [filtroCompetencia, setFiltroCompetencia] = useState(null);
  const [vinculandoLancamentoId, setVinculandoLancamentoId] = useState(null);
  const [linhasVinculadasRecentes, setLinhasVinculadasRecentes] = useState(() => new Set());

  const imovelId = useMemo(() => {
    const st = location.state && typeof location.state === 'object' ? location.state : null;
    const fromState = st?.imovelId != null ? Number(st.imovelId) : NaN;
    if (Number.isFinite(fromState) && fromState >= 1) return Math.floor(fromState);
    const q = new URLSearchParams(location.search || '');
    const fromQ = Number(q.get('imovel'));
    if (Number.isFinite(fromQ) && fromQ >= 1) return Math.floor(fromQ);
    return 1;
  }, [location.state, location.search]);

  const imovelIdApi = useMemo(() => {
    const st = location.state && typeof location.state === 'object' ? location.state : null;
    const fromState = st?.imovelIdApi != null ? Number(st.imovelIdApi) : NaN;
    if (Number.isFinite(fromState) && fromState >= 1) return Math.floor(fromState);
    const q = new URLSearchParams(location.search || '');
    const fromQ = Number(q.get('imovelApi'));
    if (Number.isFinite(fromQ) && fromQ >= 1) return Math.floor(fromQ);
    return null;
  }, [location.state, location.search]);

  const mock = useMemo(() => imovelUi, [imovelUi]);
  const codigoStr = mock ? String(mock.codigo ?? '').trim() : '';
  const procStr = mock ? String(mock.proc ?? '').trim() : '';
  const vinculoOk = codigoStr !== '' && procStr !== '';
  const painel = painelApi;

  const alertas = useMemo(() => {
    if (!painel || !mock) return [];
    return gerarAlertasAdministracaoImovel(mock, painel.porMes, painel.mesesOrdenados);
  }, [painel, mock]);

  const recarregar = useCallback(() => setRefreshTick((t) => t + 1), []);
  const recarregarReconciliacao = useCallback(() => setReconcTick((t) => t + 1), []);

  const contratoId = useMemo(() => {
    const n = Number(mock?._apiContratoId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [mock]);

  const recarregarReconciliacaoDados = useCallback(
    async (compRef) => {
      if (!featureFlags.useApiImoveis || !contratoId) return;
      const comp = compRef ?? competencia;
      const [mat, vinculos, res] = await Promise.all([
        obterMatrizCompetenciasApi(contratoId, { meses: 18 }),
        listarVinculosReconciliacaoApi(contratoId),
        obterResultadoImovelApi(contratoId, { competencia: comp }),
      ]);
      setMatriz(mat || null);
      setVinculosContrato(Array.isArray(vinculos) ? vinculos : []);
      setResultado(res || null);
    },
    [contratoId, competencia],
  );

  const marcarLinhaVinculada = useCallback((lancamentoId) => {
    const id = Number(lancamentoId);
    if (!Number.isFinite(id)) return;
    setLinhasVinculadasRecentes((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setLinhasVinculadasRecentes((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 5000);
  }, []);

  const pendenciasMatriz = useMemo(() => contarPendenciasMatriz(matriz?.meses), [matriz?.meses]);

  const competenciaAtiva = filtroCompetencia ?? competencia;
  const itemCompetenciaAtiva = useMemo(
    () => itemMatrizPorCompetencia(matriz?.meses, competenciaAtiva),
    [matriz?.meses, competenciaAtiva],
  );

  const competenciaRange = useMemo(() => {
    const min = contratoVigenteApi?.dataInicio ? String(contratoVigenteApi.dataInicio).slice(0, 7) : undefined;
    const max = contratoVigenteApi?.dataFim ? String(contratoVigenteApi.dataFim).slice(0, 7) : undefined;
    return { min, max };
  }, [contratoVigenteApi]);

  /** lancamentoFinanceiroId → { papel, competenciaMes, vinculoId } */
  const vinculosPorLancamento = useMemo(() => {
    const map = new Map();
    for (const v of vinculosContrato || []) {
      const id = Number(v?.lancamentoFinanceiroId);
      if (!Number.isFinite(id)) continue;
      map.set(id, {
        vinculoId: v.id,
        papel: v.papel,
        competenciaMes: v.competenciaMes,
        rotuloClassificacao: v.rotuloClassificacao ?? null,
      });
    }
    return map;
  }, [vinculosContrato]);

  useEffect(() => {
    if (!sucesso) return;
    const t = window.setTimeout(() => setSucesso(''), 8000);
    return () => window.clearTimeout(t);
  }, [sucesso]);

  useEffect(() => {
    if (!featureFlags.useApiImoveis || !contratoId) {
      setMatriz(null);
      setVinculosContrato([]);
      setResultado(null);
      return;
    }
    let ativo = true;
    setErroReconc('');
    setCarregandoMatriz(true);
    Promise.all([
      obterMatrizCompetenciasApi(contratoId, { meses: 18 }),
      listarVinculosReconciliacaoApi(contratoId),
      obterResultadoImovelApi(contratoId, { competencia }),
    ])
      .then(([mat, vinculos, res]) => {
        if (!ativo) return;
        setMatriz(mat || null);
        setVinculosContrato(Array.isArray(vinculos) ? vinculos : []);
        setResultado(res || null);
        if (mat?.meses?.length && !mat.meses.some((m) => m.competencia === competencia)) {
          const primeiraPendente = mat.meses.find((m) => m.estado !== 'VINCULADO');
          setCompetencia(primeiraPendente?.competencia ?? mat.meses[0]?.competencia ?? competencia);
        }
      })
      .catch((e) => {
        if (!ativo) return;
        setErroReconc(e?.message || 'Falha ao carregar classificação de aluguéis.');
      })
      .finally(() => {
        if (ativo) setCarregandoMatriz(false);
      });
    return () => {
      ativo = false;
    };
  }, [contratoId, reconcTick]);

  useEffect(() => {
    if (!featureFlags.useApiImoveis || !contratoId || !competencia) return;
    let ativo = true;
    obterResultadoImovelApi(contratoId, { competencia })
      .then((res) => {
        if (ativo) setResultado(res || null);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [contratoId, competencia]);

  async function confirmarAluguel(candidato, comp) {
    if (!contratoId || !candidato?.lancamentoFinanceiroId) return;
    if (!competenciaValida(comp)) {
      setErroReconc('Informe o mês de referência (AAAA-MM) antes de confirmar.');
      return;
    }
    const lancId = Number(candidato.lancamentoFinanceiroId);
    setVinculandoLancamentoId(lancId);
    setSalvandoReconc(true);
    setErroReconc('');
    setSucesso('');
    try {
      const saved = await vincularReconciliacaoApi(contratoId, [
        {
          lancamentoFinanceiroId: lancId,
          papel: 'ALUGUEL',
          competenciaMes: comp,
        },
      ]);
      setVinculosContrato((prev) => mergeVinculosRespostaApi(prev, saved));
      marcarLinhaVinculada(lancId);
      setMatriz((prev) => {
        if (!prev?.meses) return prev;
        const vinculoSalvo = saved?.[0];
        return {
          ...prev,
          meses: prev.meses.map((m) =>
            m.competencia === comp
              ? {
                  ...m,
                  estado: 'VINCULADO',
                  aluguelVinculado: {
                    lancamentoFinanceiroId: lancId,
                    vinculoId: vinculoSalvo?.id,
                    valor: vinculoSalvo?.valor ?? candidato.valor,
                    data: candidato.data,
                    descricao: candidato.descricao,
                  },
                }
              : m,
          ),
        };
      });
      setSucesso(`Aluguel vinculado · ref. ${comp}.`);
      setCompetencia(comp);
      setFiltroCompetencia(comp);
      await recarregarReconciliacaoDados(comp);
      recarregar();
    } catch (e) {
      setErroReconc(e?.message || 'Falha ao vincular aluguel.');
    } finally {
      setVinculandoLancamentoId(null);
      setSalvandoReconc(false);
    }
  }

  async function confirmarRepasse(candidato, comp) {
    if (!contratoId || !candidato?.lancamentoFinanceiroId) return;
    if (!competenciaValida(comp)) {
      setErroReconc('Informe o mês de referência (AAAA-MM) antes de confirmar.');
      return;
    }
    const lancId = Number(candidato.lancamentoFinanceiroId);
    setVinculandoLancamentoId(lancId);
    setSalvandoReconc(true);
    setErroReconc('');
    setSucesso('');
    try {
      const saved = await vincularReconciliacaoApi(contratoId, [
        {
          lancamentoFinanceiroId: lancId,
          papel: 'REPASSE',
          competenciaMes: comp,
        },
      ]);
      setVinculosContrato((prev) => mergeVinculosRespostaApi(prev, saved));
      marcarLinhaVinculada(lancId);
      setSucesso(`Repasse vinculado · ref. ${comp}.`);
      setCompetencia(comp);
      setFiltroCompetencia(comp);
      await recarregarReconciliacaoDados(comp);
      recarregar();
    } catch (e) {
      setErroReconc(e?.message || 'Falha ao vincular repasse.');
    } finally {
      setVinculandoLancamentoId(null);
      setSalvandoReconc(false);
    }
  }

  async function confirmarVinculoManual(candidato, papel, comp, rotuloClassificacao = null) {
    if (!contratoId || !candidato?.lancamentoFinanceiroId) return;
    const papelApi = String(papel ?? '').toUpperCase();
    if (papelApi !== 'ALUGUEL' && papelApi !== 'REPASSE' && papelApi !== 'DESPESA') {
      setErroReconc('Escolha o tipo do lançamento antes de vincular.');
      return;
    }
    if (!competenciaValida(comp)) {
      setErroReconc('Informe o mês de referência (AAAA-MM) antes de confirmar.');
      return;
    }
    const rotulo = String(rotuloClassificacao ?? '').trim() || null;
    const lancId = Number(candidato.lancamentoFinanceiroId);
    setVinculandoLancamentoId(lancId);
    setSalvandoReconc(true);
    setErroReconc('');
    setSucesso('');
    try {
      const saved = await vincularReconciliacaoApi(contratoId, [
        {
          lancamentoFinanceiroId: lancId,
          papel: papelApi,
          competenciaMes: comp,
          rotuloClassificacao: rotulo,
        },
      ]);
      setVinculosContrato((prev) => mergeVinculosRespostaApi(prev, saved));
      marcarLinhaVinculada(lancId);
      if (papelApi === 'ALUGUEL') {
        setMatriz((prev) => {
          if (!prev?.meses) return prev;
          const vinculoSalvo = saved?.[0];
          return {
            ...prev,
            meses: prev.meses.map((m) =>
              m.competencia === comp
                ? {
                    ...m,
                    estado: 'VINCULADO',
                    aluguelVinculado: {
                      lancamentoFinanceiroId: lancId,
                      vinculoId: vinculoSalvo?.id,
                      valor: vinculoSalvo?.valor ?? candidato.valor,
                      data: candidato.data,
                      descricao: candidato.descricao,
                    },
                  }
                : m,
            ),
          };
        });
      }
      const rotuloSucesso =
        rotulo || (papelApi === 'ALUGUEL' ? 'Aluguel' : papelApi === 'REPASSE' ? 'Repasse' : 'Despesa');
      setSucesso(`${rotuloSucesso} vinculado · ref. ${comp}.`);
      setCompetencia(comp);
      setFiltroCompetencia(comp);
      await recarregarReconciliacaoDados(comp);
      recarregar();
    } catch (e) {
      setErroReconc(e?.message || 'Falha ao vincular lançamento.');
    } finally {
      setVinculandoLancamentoId(null);
      setSalvandoReconc(false);
    }
  }

  async function confirmarTodasSugestoes(itens) {
    if (!contratoId || !Array.isArray(itens) || itens.length === 0) return;
    setSalvandoReconc(true);
    setErroReconc('');
    setSucesso('');
    try {
      const saved = await vincularReconciliacaoApi(contratoId, itens);
      setVinculosContrato((prev) => mergeVinculosRespostaApi(prev, saved));
      for (const item of itens) {
        marcarLinhaVinculada(item.lancamentoFinanceiroId);
      }
      setMatriz((prev) => {
        if (!prev?.meses) return prev;
        let meses = prev.meses;
        for (const item of itens.filter((i) => i.papel === 'ALUGUEL')) {
          const lancId = Number(item.lancamentoFinanceiroId);
          const vinculoSalvo = saved?.find((s) => Number(s.lancamentoFinanceiroId) === lancId);
          meses = meses.map((m) =>
            m.competencia === item.competenciaMes
              ? {
                  ...m,
                  estado: 'VINCULADO',
                  aluguelVinculado: {
                    lancamentoFinanceiroId: lancId,
                    vinculoId: vinculoSalvo?.id,
                    valor: vinculoSalvo?.valor,
                  },
                }
              : m,
          );
        }
        return { ...prev, meses };
      });
      const n = saved?.length ?? itens.length;
      setSucesso(`${n} sugest${n === 1 ? 'ão' : 'ões'} vinculada${n === 1 ? '' : 's'}.`);
      await recarregarReconciliacaoDados();
      recarregar();
    } catch (e) {
      setErroReconc(e?.message || 'Falha ao vincular sugestões em lote.');
    } finally {
      setSalvandoReconc(false);
    }
  }

  async function moverCompetenciaVinculo(vinc, novaCompetencia) {
    if (!contratoId || !vinc?.lancamentoFinanceiroId || !competenciaValida(novaCompetencia)) return;
    const papel = String(vinc?.papel ?? 'ALUGUEL').toUpperCase();
    if (papel !== 'ALUGUEL' && papel !== 'REPASSE' && papel !== 'DESPESA') return;
    setSalvandoReconc(true);
    setErroReconc('');
    setSucesso('');
    try {
      await vincularReconciliacaoApi(contratoId, [
        {
          lancamentoFinanceiroId: vinc.lancamentoFinanceiroId,
          papel,
          competenciaMes: novaCompetencia,
        },
      ]);
      setSucesso(`Referência movida para ${novaCompetencia}.`);
      setCompetencia(novaCompetencia);
      setFiltroCompetencia(novaCompetencia);
      recarregarReconciliacao();
      recarregar();
    } catch (e) {
      setErroReconc(e?.message || 'Falha ao alterar a referência do mês.');
    } finally {
      setSalvandoReconc(false);
    }
  }

  async function desvincularAluguel(vinculoId) {
    if (!contratoId || !vinculoId) return;
    setSalvandoReconc(true);
    setErroReconc('');
    try {
      await desvincularReconciliacaoApi(contratoId, vinculoId);
      setSucesso('Vínculo removido.');
      recarregarReconciliacao();
      recarregar();
    } catch (e) {
      setErroReconc(e?.message || 'Falha ao desvincular.');
    } finally {
      setSalvandoReconc(false);
    }
  }

  async function gerarRepassesInternos(comp) {
    if (!contratoId) return;
    setGerandoRepasses(true);
    setErroReconc('');
    setSucesso('');
    try {
      const resp = await gerarRepassesInternosApi(contratoId, { competencia: comp });
      const n = Number(resp?.repassesGerados) || 0;
      setSucesso(
        n > 0
          ? `${n} repasse${n === 1 ? '' : 's'} gerado${n === 1 ? '' : 's'} na conta REPASSE INTERNO.`
          : 'Nenhum repasse pendente nesta competência.',
      );
      recarregarReconciliacao();
      recarregar();
    } catch (e) {
      setErroReconc(e?.message || 'Falha ao gerar repasses internos.');
    } finally {
      setGerandoRepasses(false);
    }
  }

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    void carregarPainelAdministracaoImovel({ imovelId, imovelIdApi })
      .then((r) => {
        if (!ativo) return;
        setImovelUi(r.imovel);
        setPainelApi(r.painelFinanceiro);
        setContratoVigenteApi(r.contratoVigente ?? null);
      })
      .catch((e) => {
        if (!ativo) return;
        setErro(e?.message || 'Falha ao carregar dados da administração imobiliária.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [imovelId, imovelIdApi, refreshTick]);

  useEffect(() => {
    const st = location.state && typeof location.state === 'object' ? location.state : null;
    if (st?.focoReconciliacao) {
      setCompetencia(competenciaAtual());
    }
  }, [location.state]);

  const jaRolouParaAncoraRef = useRef(false);
  useEffect(() => {
    if (jaRolouParaAncoraRef.current) return;
    const hash = location.hash;
    const alvo =
      hash === '#reconciliacao-imoveis'
        ? 'reconciliacao-imoveis'
        : hash === '#extrato-imoveis'
          ? 'extrato-imoveis'
          : null;
    if (!alvo) return;
    const el = document.getElementById(alvo);
    if (!el) return;
    jaRolouParaAncoraRef.current = true;
    window.requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [location.hash, painel, contratoId]);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] p-4">
      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Cabeçalho compacto */}
        <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
          <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() =>
                  navigate('/imoveis', {
                    state: mock ? { numeroPlanilha: mock.imovelId } : { imovelId },
                  })
                }
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-slate-800 truncate flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden />
                  {String(mock?.unidade || mock?.condominio || `Imóvel ${imovelId}`).trim()}
                </h1>
                <p className="text-xs text-slate-600 truncate">
                  {mock?.inquilino ? `${mock.inquilino} · ` : ''}
                  {mock?.valorLocacao ? `Aluguel ${mock.valorLocacao}` : ''}
                  {vinculoOk ? ` · Cod. ${padCliente(codigoStr)} · Proc. ${procStr}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  recarregar();
                  recarregarReconciliacao();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs hover:bg-slate-50"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden />
                Atualizar
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate('/processos', {
                    state: buildRouterStateChaveClienteProcesso(padCliente(codigoStr || '1'), procStr || '1'),
                  })
                }
                disabled={!vinculoOk}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-xs disabled:opacity-50"
              >
                <FolderOpen className="w-3.5 h-3.5" aria-hidden />
                Processos
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate('/financeiro', {
                    state: {
                      financeiroConciliacaoHonorarios: {
                        rotulo: `Imóvel ${imovelId}`,
                        ...buildRouterStateChaveClienteProcesso(padCliente(codigoStr || '1'), procStr || '1'),
                      },
                    },
                  })
                }
                disabled={!vinculoOk}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-emerald-600 bg-emerald-50 text-emerald-900 text-xs font-medium disabled:opacity-50"
              >
                <CircleDollarSign className="w-3.5 h-3.5" aria-hidden />
                Financeiro
              </button>
            </div>
          </div>
        </div>

        {sucesso ? (
          <div
            className="rounded-lg border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex items-center gap-2 shadow-sm"
            role="status"
          >
            <Check className="w-5 h-5 shrink-0 text-emerald-600" aria-hidden />
            <span className="font-medium">{sucesso}</span>
          </div>
        ) : null}

        {(carregando || erro || erroReconc) && (
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm space-y-1">
            {carregando ? <p className="text-indigo-700">Carregando…</p> : null}
            {erro ? <p className="text-red-700">{erro}</p> : null}
            {erroReconc ? <p className="text-red-700">{erroReconc}</p> : null}
          </div>
        )}

        {!mock && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
            Imóvel <strong>{imovelId}</strong> sem cadastro.{' '}
            <button type="button" className="underline font-medium" onClick={() => navigate('/imoveis')}>
              Voltar
            </button>
          </div>
        )}

        {mock && !vinculoOk && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
            Preencha <strong>Código</strong> e <strong>Proc.</strong> no cadastro do imóvel.
          </div>
        )}

        {mock && vinculoOk && (
          <>
            {pendenciasMatriz > 0 ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
                <span>
                  <strong>{pendenciasMatriz}</strong> competência{pendenciasMatriz === 1 ? '' : 's'} sem aluguel
                  vinculado — filtre e classifique na conta corrente.
                </span>
              </div>
            ) : null}

            {!contratoId ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Sem contrato vigente — cadastre um contrato de locação para classificar aluguéis.
              </div>
            ) : null}

            {painel ? (
              <div id="reconciliacao-imoveis" className="space-y-4 scroll-mt-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(240px,280px)_1fr] xl:items-start">
                  {contratoId ? (
                    <div className="space-y-2 xl:sticky xl:top-24 xl:self-start">
                      <ImoveisAluguelChecklist
                        meses={matriz?.meses}
                        competenciaAtiva={competenciaAtiva}
                        onSelecionarCompetencia={(comp) => {
                          setCompetencia(comp);
                          setFiltroCompetencia(comp);
                        }}
                        valorAluguelContrato={matriz?.valorAluguelContrato ?? contratoVigenteApi?.valorAluguel}
                        carregando={carregandoMatriz}
                        modoFiltro
                      />
                      {filtroCompetencia ? (
                        <button
                          type="button"
                          onClick={() => setFiltroCompetencia(null)}
                          className="w-full text-center text-xs text-indigo-700 hover:underline py-1"
                        >
                          Limpar filtro · ver conta corrente inteira
                        </button>
                      ) : null}
                      <ImoveisPendenciasAluguel
                        competencia={competenciaAtiva}
                        itemMatriz={itemCompetenciaAtiva}
                        repasseInterno={matriz?.repasseInterno ?? resultado?.repasseInterno}
                        salvando={salvandoReconc}
                        vinculandoLancamentoId={vinculandoLancamentoId}
                        gerandoRepasses={gerandoRepasses}
                        competenciaMin={competenciaRange.min}
                        competenciaMax={competenciaRange.max}
                        onConfirmarAluguel={confirmarAluguel}
                        onMoverCompetencia={moverCompetenciaVinculo}
                        onDesvincular={desvincularAluguel}
                        onGerarRepasse={gerarRepassesInternos}
                      />
                    </div>
                  ) : null}
                  <ImoveisContaCorrenteTrabalho
                    transacoes={painel.transacoes}
                    vinculosPorLancamento={vinculosPorLancamento}
                    vinculandoLancamentoId={vinculandoLancamentoId}
                    linhasVinculadasRecentes={linhasVinculadasRecentes}
                    filtroCompetencia={filtroCompetencia}
                    onLimparFiltro={() => setFiltroCompetencia(null)}
                    competenciaMin={competenciaRange.min}
                    competenciaMax={competenciaRange.max}
                    contratoId={contratoId}
                    repasseInterno={matriz?.repasseInterno ?? resultado?.repasseInterno}
                    salvando={salvandoReconc}
                    gerandoRepasses={gerandoRepasses}
                    onConfirmarAluguel={confirmarAluguel}
                    onConfirmarRepasse={confirmarRepasse}
                    onConfirmarVinculoManual={confirmarVinculoManual}
                    onAprovarTodasSugestoes={confirmarTodasSugestoes}
                    onMoverCompetencia={moverCompetenciaVinculo}
                    onDesvincular={desvincularAluguel}
                    onGerarRepasse={gerarRepassesInternos}
                    codigoCliente={padCliente(codigoStr)}
                    proc={procStr}
                  />
                </div>

                {alertas.length > 0 ? (
                  <SecaoColapsavel
                    titulo="Alertas do extrato"
                    subtitulo={`${alertas.length} aviso${alertas.length === 1 ? '' : 's'} — meses sem aluguel ou repasse identificado`}
                    aberto={alertasAbertos}
                    onToggle={() => setAlertasAbertos((v) => !v)}
                  >
                    <ul className="pt-2 max-h-48 overflow-y-auto list-disc pl-5 space-y-0.5 text-sm text-amber-950">
                      {alertas.map((a, i) => (
                        <li key={`${a.tipo}-${a.mes}-${i}`}>{a.texto}</li>
                      ))}
                    </ul>
                  </SecaoColapsavel>
                ) : null}

                {contratoId && resultado ? (
                  <SecaoColapsavel
                    titulo="Resumo financeiro"
                    subtitulo={`Competência ${filtroCompetencia ?? competencia}`}
                    aberto={resultadoAberto}
                    onToggle={() => setResultadoAberto((v) => !v)}
                  >
                    <div className="pt-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {(() => {
                          const info = statusRepasseInfo(resultado.statusRepasse);
                          return (
                            <span
                              className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${info.cls}`}
                            >
                              {info.label}
                            </span>
                          );
                        })()}
                        {resultado.repasseInterno ? (
                          <span className="text-[11px] text-teal-800">Imóvel próprio · repasse via conta virtual</span>
                        ) : null}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <KpiResultado titulo="Aluguel recebido" valor={formatBRL(resultado.aluguelRecebido)} tom="emerald" />
                        <KpiResultado titulo="Repassado" valor={formatBRL(resultado.repassado)} tom="slate" />
                        <KpiResultado titulo="Despesas" valor={formatBRL(resultado.despesas)} tom="orange" />
                        <KpiResultado
                          titulo="Resultado escritório"
                          valor={formatBRL(resultado.resultadoEscritorio)}
                          tom="teal"
                        />
                        <KpiResultado
                          titulo="Taxa efetiva"
                          valor={`${resultado.taxaEfetivaPercent != null ? Number(resultado.taxaEfetivaPercent).toFixed(2) : '—'}%`}
                          sub={`nominal ${resultado.taxaEsperadaPercent != null ? Number(resultado.taxaEsperadaPercent).toFixed(2) : '—'}%`}
                          tom="indigo"
                        />
                      </div>
                      {String(resultado.statusRepasse).toUpperCase() === 'DIVERGENTE' ? (
                        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                          Esperado{' '}
                          <strong>
                            {formatBRL(
                              repasseEsperado(
                                resultado,
                                matriz?.valorAluguelContrato ?? contratoVigenteApi?.valorAluguel,
                              ),
                            )}
                          </strong>{' '}
                          · real{' '}
                          <strong>{formatBRL(resultado.repassado)}</strong>
                        </p>
                      ) : null}
                    </div>
                  </SecaoColapsavel>
                ) : null}

                {contratoId ? (
                  <SecaoColapsavel
                    titulo="Detalhes do imóvel e contrato"
                    aberto={detalhesAbertos}
                    onToggle={() => setDetalhesAbertos((v) => !v)}
                  >
                    <div className="pt-3 grid gap-3 sm:grid-cols-3 text-sm">
                      <div className="rounded border border-slate-100 bg-slate-50/80 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase text-slate-500">Locador</p>
                        <p className="font-medium">{mock.proprietario || '—'}</p>
                      </div>
                      <div className="rounded border border-slate-100 bg-slate-50/80 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase text-slate-500">Locatário</p>
                        <p className="font-medium">{mock.inquilino || '—'}</p>
                      </div>
                      <div className="rounded border border-slate-100 bg-slate-50/80 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase text-slate-500">Contrato API</p>
                        <p className="font-mono text-xs">
                          id {contratoVigenteApi?.id ?? contratoId} · {contratoVigenteApi?.status ?? '—'}
                        </p>
                      </div>
                    </div>
                  </SecaoColapsavel>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
