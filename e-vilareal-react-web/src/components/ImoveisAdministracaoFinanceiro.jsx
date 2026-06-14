import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Landmark,
  FolderOpen,
  CircleDollarSign,
  AlertTriangle,
} from 'lucide-react';
import { padCliente } from '../data/processosDadosRelatorio.js';
import {
  gerarAlertasAdministracaoImovel,
  nomeContaPorLetra,
  PAPEL_CREDITO,
  PAPEL_DEBITO,
  PAPEL_DESPESA_REPASSAR,
  processoEhAdministracaoImovel,
  rotuloPapelAdministracao,
} from '../data/imoveisAdministracaoFinanceiro.js';
import { ImoveisSugestoesVinculoPanel } from './imoveis/ImoveisSugestoesVinculoPanel.jsx';
import {
  carregarPainelAdministracaoImovel,
  desvincularReconciliacaoApi,
  obterResultadoImovelApi,
  recarregarSomentePainelFinanceiroImovel,
  salvarDespesaLocacao,
  salvarRepasseLocacao,
  sugerirReconciliacaoApi,
  vincularReconciliacaoApi,
} from '../repositories/imoveisRepository.js';
import {
  agruparLinhasReconciliacao,
  competenciaAtual,
  competenciaValida,
  confiancaInfo,
  descricaoAdocao,
  linhasReconciliacaoFromSugestoes,
  montarPayloadVinculos,
  PAPEIS_RECONCILIACAO,
  repasseEsperado,
  rotuloPapelReconciliacao,
  statusRepasseInfo,
} from '../data/imoveisReconciliacao.js';
import { featureFlags } from '../config/featureFlags.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';

function formatBRL(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

/** Valores negativos em vermelho. */
function corValorNegativo(n) {
  // `important` (sufixo `!`, sintaxe Tailwind v4) garante prioridade sobre o `text-slate-800` da base `td`.
  return Number(n) < 0 ? 'text-red-600!' : '';
}

const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-200 bg-slate-100 whitespace-nowrap';
const td = 'px-3 py-2 text-sm text-slate-800 border-b border-slate-100 align-top';

const KPI_TONS = {
  emerald: 'text-emerald-800',
  slate: 'text-slate-800',
  orange: 'text-orange-800',
  teal: 'text-teal-800',
  indigo: 'text-indigo-800',
};

function KpiResultado({ titulo, valor, sub, tom = 'slate' }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${KPI_TONS[tom] || KPI_TONS.slate}`}>{valor}</p>
      {sub ? <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p> : null}
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
  const [repassesApi, setRepassesApi] = useState([]);
  const [despesasApi, setDespesasApi] = useState([]);
  const [contratoVigenteApi, setContratoVigenteApi] = useState(null);
  const [repasseEditandoId, setRepasseEditandoId] = useState(null);
  const [repasseDraft, setRepasseDraft] = useState(null);
  const [salvandoRepasse, setSalvandoRepasse] = useState(false);
  const [despesaEditandoId, setDespesaEditandoId] = useState(null);
  const [despesaDraft, setDespesaDraft] = useState(null);
  const [salvandoDespesa, setSalvandoDespesa] = useState(false);
  const [novoRepasse, setNovoRepasse] = useState({
    competenciaMes: '',
    valorRecebidoInquilino: '',
    valorRepassadoLocador: '',
    valorDespesasRepassar: '',
    remuneracaoEscritorio: '',
  });
  const [novaDespesa, setNovaDespesa] = useState({
    competenciaMes: '',
    descricao: '',
    valor: '',
    categoria: 'OUTROS',
  });

  // Reconciliação (Fase B) — verdade vem do backend.
  const [competencia, setCompetencia] = useState(() => competenciaAtual());
  const [modoPeriodo, setModoPeriodo] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [resultado, setResultado] = useState(null);
  const [carregandoResultado, setCarregandoResultado] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false);
  const [papeisEditados, setPapeisEditados] = useState({});
  const [selecionadas, setSelecionadas] = useState(() => new Set());
  const [salvandoReconc, setSalvandoReconc] = useState(false);
  const [erroReconc, setErroReconc] = useState('');
  const [reconcTick, setReconcTick] = useState(0);
  // Competência editável por vínculo de ALUGUEL (chave = lancamentoFinanceiroId). O draft persiste
  // entre recargas para refletir a competência movida (o backend não expõe a competência crua do vínculo).
  const [competenciaVinculoDraft, setCompetenciaVinculoDraft] = useState({});

  /** Nº do imóvel na planilha (col. A) — mesmo valor exibido no cadastro e no relatório. */
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

  const ehAdm = vinculoOk && processoEhAdministracaoImovel(codigoStr, procStr, { assumirAdm: true });
  const painelFonteApi = painel?.fonte === 'api' && featureFlags.useApiFinanceiro;

  const recarregar = useCallback(() => setRefreshTick((t) => t + 1), []);

  /** Após aprovar vínculo: só atualiza extrato/conta corrente, sem travar a página inteira. */
  const atualizarExtratoAposVinculo = useCallback(() => {
    if (!vinculoOk) return;
    void recarregarSomentePainelFinanceiroImovel({ imovelId, imovelIdApi }).then((painel) => {
      if (painel) setPainelApi(painel);
    });
  }, [imovelId, imovelIdApi, vinculoOk]);

  const contratoId = useMemo(() => {
    const n = Number(mock?._apiContratoId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [mock]);

  const recarregarReconciliacao = useCallback(() => setReconcTick((t) => t + 1), []);

  // Range opcional (AAAA-MM) para o seletor de competência: período do contrato vigente.
  const competenciaRange = useMemo(() => {
    const min = contratoVigenteApi?.dataInicio ? String(contratoVigenteApi.dataInicio).slice(0, 7) : undefined;
    const max = contratoVigenteApi?.dataFim ? String(contratoVigenteApi.dataFim).slice(0, 7) : undefined;
    return { min, max };
  }, [contratoVigenteApi]);

  // Limpa os drafts ao trocar de contrato (evita carregar competências de outro imóvel).
  useEffect(() => {
    setCompetenciaVinculoDraft({});
  }, [contratoId]);

  useEffect(() => {
    if (!featureFlags.useApiImoveis || !contratoId) {
      setResultado(null);
      setSugestoes([]);
      return;
    }
    let ativo = true;
    setErroReconc('');
    setCarregandoResultado(true);
    setCarregandoSugestoes(true);
    const queryResultado =
      modoPeriodo && periodoInicio && periodoFim
        ? { inicio: periodoInicio, fim: periodoFim }
        : { competencia };
    Promise.all([
      obterResultadoImovelApi(contratoId, queryResultado),
      sugerirReconciliacaoApi(contratoId, competencia),
    ])
      .then(([res, sug]) => {
        if (!ativo) return;
        setResultado(res || null);
        const linhas = linhasReconciliacaoFromSugestoes(sug);
        setSugestoes(linhas);
        setPapeisEditados((prev) => {
          const next = {};
          for (const l of linhas) {
            const id = l.lancamentoFinanceiroId;
            next[id] = prev[id] || l.papelVinculado || l.papelSugerido || 'ALUGUEL';
          }
          return next;
        });
        // Semeia a competência editável dos aluguéis vinculados; preserva o que já foi movido nesta sessão.
        setCompetenciaVinculoDraft((prev) => {
          const next = { ...prev };
          for (const l of linhas) {
            if (l.jaVinculado && l.papelVinculado === 'ALUGUEL') {
              const id = l.lancamentoFinanceiroId;
              if (next[id] == null) next[id] = l.competenciaSugerida || '';
            }
          }
          return next;
        });
        setSelecionadas(new Set());
      })
      .catch((e) => {
        if (!ativo) return;
        setErroReconc(e?.message || 'Falha ao carregar a reconciliação.');
      })
      .finally(() => {
        if (!ativo) return;
        setCarregandoResultado(false);
        setCarregandoSugestoes(false);
      });
    return () => {
      ativo = false;
    };
  }, [contratoId, competencia, modoPeriodo, periodoInicio, periodoFim, reconcTick]);

  function setPapelLinha(id, papel) {
    setPapeisEditados((s) => ({ ...s, [id]: papel }));
  }

  function toggleSelecionada(id) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function aplicarVinculos(itens) {
    const payload = montarPayloadVinculos(itens);
    if (payload.length === 0 || !contratoId) return;
    setSalvandoReconc(true);
    setErroReconc('');
    try {
      await vincularReconciliacaoApi(contratoId, payload);
      recarregarReconciliacao();
    } catch (e) {
      setErroReconc(e?.message || 'Falha ao confirmar vínculo.');
    } finally {
      setSalvandoReconc(false);
    }
  }

  function confirmarLinha(linha) {
    void aplicarVinculos([
      {
        lancamentoFinanceiroId: linha.lancamentoFinanceiroId,
        papel: papeisEditados[linha.lancamentoFinanceiroId] || linha.papelSugerido,
        competenciaMes: competencia,
      },
    ]);
  }

  function confirmarLote() {
    const itens = sugestoes
      .filter((l) => selecionadas.has(l.lancamentoFinanceiroId) && !l.jaVinculado)
      .map((l) => ({
        lancamentoFinanceiroId: l.lancamentoFinanceiroId,
        papel: papeisEditados[l.lancamentoFinanceiroId] || l.papelSugerido,
        competenciaMes: competencia,
      }));
    void aplicarVinculos(itens);
  }

  async function moverCompetenciaAluguel(linha, novaCompetencia) {
    if (!contratoId || !linha?.lancamentoFinanceiroId) return;
    const id = linha.lancamentoFinanceiroId;
    const anterior = competenciaVinculoDraft[id] ?? linha.competenciaSugerida ?? '';
    if (!competenciaValida(novaCompetencia)) {
      setErroReconc('Informe uma competência válida (AAAA-MM).');
      return;
    }
    if (novaCompetencia === anterior) return;
    // Atualização otimista do campo; revertida em caso de erro.
    setCompetenciaVinculoDraft((s) => ({ ...s, [id]: novaCompetencia }));
    setSalvandoReconc(true);
    setErroReconc('');
    setSucesso('');
    try {
      // Upsert: mesmo lançamento + papel ALUGUEL com a nova competência. O backend atualiza o
      // vínculo (não cria outro) e move o par de repasse interno junto (sincronizarCompetenciaDoPar).
      await vincularReconciliacaoApi(contratoId, [
        { lancamentoFinanceiroId: Number(id), papel: 'ALUGUEL', competenciaMes: novaCompetencia },
      ]);
      setSucesso(`Competência movida para ${novaCompetencia}`);
      recarregarReconciliacao();
    } catch (e) {
      setCompetenciaVinculoDraft((s) => ({ ...s, [id]: anterior }));
      setErroReconc(e?.message || 'Falha ao mover a competência.');
    } finally {
      setSalvandoReconc(false);
    }
  }

  async function desvincularLinha(linha) {
    if (!linha?.vinculoId || !contratoId) return;
    setSalvandoReconc(true);
    setErroReconc('');
    try {
      await desvincularReconciliacaoApi(contratoId, linha.vinculoId);
      recarregarReconciliacao();
    } catch (e) {
      setErroReconc(e?.message || 'Falha ao desvincular.');
    } finally {
      setSalvandoReconc(false);
    }
  }

  const gruposReconc = useMemo(() => agruparLinhasReconciliacao(sugestoes), [sugestoes]);

  function renderLinhaReconc(l, adocao) {
    const conf = confiancaInfo(l.confianca);
    const papelAtual = papeisEditados[l.lancamentoFinanceiroId] || l.papelSugerido || 'ALUGUEL';
    // Exibe o valor com o sinal do lançamento (DÉBITO/saída = negativo), igual ao extrato.
    // A sugestão traz o valor sempre positivo; o sinal real vem da natureza.
    const valorExibicao =
      String(l.natureza ?? '').toUpperCase() === 'DEBITO'
        ? -Math.abs(Number(l.valor) || 0)
        : Number(l.valor) || 0;
    return (
      <tr
        key={l.lancamentoFinanceiroId}
        className={l.jaVinculado ? 'bg-emerald-50/40' : adocao ? 'bg-amber-50/30' : ''}
      >
        <td className={td}>
          <input
            type="checkbox"
            checked={selecionadas.has(l.lancamentoFinanceiroId)}
            onChange={() => toggleSelecionada(l.lancamentoFinanceiroId)}
            disabled={l.jaVinculado || salvandoReconc}
            aria-label={`Selecionar lançamento ${l.lancamentoFinanceiroId}`}
          />
        </td>
        <td className={`${td} tabular-nums whitespace-nowrap`}>
          {l.data ? String(l.data).slice(0, 10) : '—'}
        </td>
        <td className={td}>
          <div>{l.descricao || '—'}</div>
          {adocao ? (
            <div className="text-[11px] text-amber-800 mt-0.5">{descricaoAdocao(l, papelAtual)}</div>
          ) : null}
        </td>
        <td className={`${td} text-right tabular-nums whitespace-nowrap ${corValorNegativo(valorExibicao)}`}>{formatBRL(valorExibicao)}</td>
        <td className={td}>
          <select
            value={papelAtual}
            onChange={(e) => setPapelLinha(l.lancamentoFinanceiroId, e.target.value)}
            disabled={l.jaVinculado || salvandoReconc}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          >
            {PAPEIS_RECONCILIACAO.map((p) => (
              <option key={p} value={p}>
                {rotuloPapelReconciliacao(p)}
              </option>
            ))}
          </select>
        </td>
        <td className={td}>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${conf.cls}`}
          >
            {conf.label}
          </span>
        </td>
        <td className={td}>
          {l.jaVinculado ? (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-emerald-800 font-medium">
                Vinculado: {rotuloPapelReconciliacao(l.papelVinculado)}
              </span>
              {l.papelVinculado === 'ALUGUEL' ? (
                <label className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                  Competência
                  <input
                    type="month"
                    value={competenciaVinculoDraft[l.lancamentoFinanceiroId] ?? l.competenciaSugerida ?? ''}
                    min={competenciaRange.min}
                    max={competenciaRange.max}
                    disabled={salvandoReconc}
                    onChange={(e) => void moverCompetenciaAluguel(l, e.target.value)}
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] tabular-nums disabled:opacity-50"
                    aria-label={`Mover competência do aluguel ${l.lancamentoFinanceiroId}`}
                  />
                </label>
              ) : null}
            </div>
          ) : adocao ? (
            <span className="text-[11px] text-amber-800 font-medium">Adotar ao confirmar</span>
          ) : (
            <span className="text-[11px] text-slate-500">A vincular</span>
          )}
        </td>
        <td className={td}>
          {l.jaVinculado ? (
            <button
              type="button"
              disabled={salvandoReconc}
              onClick={() => void desvincularLinha(l)}
              className="px-2 py-0.5 rounded border border-red-300 text-red-700 text-[11px] font-medium hover:bg-red-50 disabled:opacity-40"
            >
              Desvincular
            </button>
          ) : (
            <button
              type="button"
              disabled={salvandoReconc}
              onClick={() => confirmarLinha(l)}
              className={`px-2 py-0.5 rounded border text-[11px] font-medium disabled:opacity-40 ${
                adocao
                  ? 'border-amber-400 text-amber-900 hover:bg-amber-50'
                  : 'border-indigo-300 text-indigo-800 hover:bg-indigo-50'
              }`}
            >
              {adocao ? 'Adotar e confirmar' : 'Confirmar'}
            </button>
          )}
        </td>
      </tr>
    );
  }

  function renderTabelaReconc(linhas, adocao) {
    return (
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full text-left border-collapse min-w-[920px]">
          <thead>
            <tr>
              <th className={`${th} w-8`} aria-label="Selecionar" />
              <th className={th}>Data</th>
              <th className={th}>Descrição</th>
              <th className={`${th} text-right`}>Valor</th>
              <th className={th}>Papel</th>
              <th className={th}>Confiança</th>
              <th className={th}>Status</th>
              <th className={th}>Ações</th>
            </tr>
          </thead>
          <tbody>{linhas.map((l) => renderLinhaReconc(l, adocao))}</tbody>
        </table>
      </div>
    );
  }

  useEffect(() => {
    setRepasseEditandoId(null);
    setRepasseDraft(null);
    setDespesaEditandoId(null);
    setDespesaDraft(null);
  }, [imovelId, refreshTick]);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    setSucesso('');
    void carregarPainelAdministracaoImovel({ imovelId, imovelIdApi })
      .then((r) => {
        if (!ativo) return;
        setImovelUi(r.imovel);
        setPainelApi(r.painelFinanceiro);
        setRepassesApi(Array.isArray(r.repasses) ? r.repasses : []);
        setDespesasApi(Array.isArray(r.despesas) ? r.despesas : []);
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

  async function criarRepasseMinimo() {
    try {
      setErro('');
      setSucesso('');
      if (!featureFlags.useApiImoveis) {
        setSucesso('Fallback legado ativo: criação de repasse permanece somente como referência visual.');
        return;
      }
      const contratoId = Number(mock?._apiContratoId);
      if (!contratoId) throw new Error('Contrato não encontrado para este imóvel.');
      await salvarRepasseLocacao({ ...novoRepasse, contratoId });
      setSucesso('Repasse criado com sucesso na API.');
      setNovoRepasse({
        competenciaMes: '',
        valorRecebidoInquilino: '',
        valorRepassadoLocador: '',
        valorDespesasRepassar: '',
        remuneracaoEscritorio: '',
      });
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao criar repasse.');
    }
  }

  function iniciarEdicaoRepasse(r) {
    setRepasseEditandoId(r.id);
    setRepasseDraft({
      competenciaMes: r.competenciaMes || '',
      valorRecebidoInquilino: r.valorRecebidoInquilino != null ? String(r.valorRecebidoInquilino) : '',
      valorRepassadoLocador: r.valorRepassadoLocador != null ? String(r.valorRepassadoLocador) : '',
      valorDespesasRepassar: r.valorDespesasRepassar != null ? String(r.valorDespesasRepassar) : '',
      remuneracaoEscritorio: r.remuneracaoEscritorio != null ? String(r.remuneracaoEscritorio) : '',
      status: r.status || 'PENDENTE',
    });
  }

  function cancelarEdicaoRepasse() {
    setRepasseEditandoId(null);
    setRepasseDraft(null);
  }

  async function salvarEdicaoRepasse() {
    if (!repasseEditandoId || !repasseDraft) return;
    setSalvandoRepasse(true);
    setErro('');
    setSucesso('');
    try {
      if (!featureFlags.useApiImoveis) {
        setSucesso('Fallback legado ativo: edição de repasse não se aplica.');
        return;
      }
      const contratoId = Number(mock?._apiContratoId);
      if (!contratoId) throw new Error('Contrato não encontrado para este imóvel.');
      await salvarRepasseLocacao({
        id: repasseEditandoId,
        contratoId,
        competenciaMes: repasseDraft.competenciaMes,
        valorRecebidoInquilino: repasseDraft.valorRecebidoInquilino,
        valorRepassadoLocador: repasseDraft.valorRepassadoLocador,
        valorDespesasRepassar: repasseDraft.valorDespesasRepassar,
        remuneracaoEscritorio: repasseDraft.remuneracaoEscritorio,
        status: repasseDraft.status,
      });
      setSucesso('Repasse atualizado com sucesso.');
      cancelarEdicaoRepasse();
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao atualizar repasse.');
    } finally {
      setSalvandoRepasse(false);
    }
  }

  async function criarDespesaMinima() {
    try {
      setErro('');
      setSucesso('');
      if (!featureFlags.useApiImoveis) {
        setSucesso('Fallback legado ativo: criação de despesa permanece somente como referência visual.');
        return;
      }
      const contratoId = Number(mock?._apiContratoId);
      if (!contratoId) throw new Error('Contrato não encontrado para este imóvel.');
      await salvarDespesaLocacao({ ...novaDespesa, contratoId });
      setSucesso('Despesa criada com sucesso na API.');
      setNovaDespesa({
        competenciaMes: '',
        descricao: '',
        valor: '',
        categoria: 'OUTROS',
      });
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao criar despesa.');
    }
  }

  function iniciarEdicaoDespesa(d) {
    setDespesaEditandoId(d.id);
    setDespesaDraft({
      competenciaMes: d.competenciaMes || '',
      descricao: d.descricao || '',
      valor: d.valor != null ? String(d.valor) : '',
      categoria: d.categoria || 'OUTROS',
    });
  }

  function cancelarEdicaoDespesa() {
    setDespesaEditandoId(null);
    setDespesaDraft(null);
  }

  async function salvarEdicaoDespesa() {
    if (!despesaEditandoId || !despesaDraft) return;
    setSalvandoDespesa(true);
    setErro('');
    setSucesso('');
    try {
      if (!featureFlags.useApiImoveis) {
        setSucesso('Fallback legado ativo: edição de despesa não se aplica.');
        return;
      }
      const contratoId = Number(mock?._apiContratoId);
      if (!contratoId) throw new Error('Contrato não encontrado para este imóvel.');
      await salvarDespesaLocacao({
        id: despesaEditandoId,
        contratoId,
        competenciaMes: despesaDraft.competenciaMes,
        descricao: despesaDraft.descricao,
        valor: despesaDraft.valor,
        categoria: despesaDraft.categoria,
      });
      setSucesso('Despesa atualizada com sucesso.');
      cancelarEdicaoDespesa();
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao atualizar despesa.');
    } finally {
      setSalvandoDespesa(false);
    }
  }

  // Rola até o extrato apenas UMA vez, na chegada via âncora. Sem o guard, qualquer
  // recarga do painel (aprovar/desvincular) re-disparava o scroll e a tela "pulava".
  const jaRolouParaExtratoRef = useRef(false);
  useEffect(() => {
    if (jaRolouParaExtratoRef.current) return;
    if (location.hash !== '#extrato-imoveis') return;
    const el = document.getElementById('extrato-imoveis');
    if (!el) return;
    jaRolouParaExtratoRef.current = true;
    window.requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [location.hash, painel]);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] p-4">
      <div className="max-w-[1400px] mx-auto space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() =>
                navigate('/imoveis', {
                  state: mock ? { numeroPlanilha: mock.imovelId } : { imovelId },
                })
              }
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm shrink-0 mt-0.5"
              aria-label="Voltar ao cadastro do imóvel"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/25 shrink-0">
                  <Landmark className="w-5 h-5" aria-hidden />
                </span>
                <span className="bg-gradient-to-r from-indigo-800 to-violet-800 dark:from-indigo-200 dark:to-violet-200 bg-clip-text text-transparent">
                  Financeiro da locação
                </span>
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                Movimentações são as mesmas da <strong>Conta Corrente</strong> em Processos e do módulo{' '}
                <strong>Financeiro</strong> (Cod. cliente + Proc.).
                {painelFonteApi ? (
                  <>
                    {' '}
                    Com a <strong>API financeira</strong> ativa, o extrato abaixo vem do servidor (não da cópia local do
                    navegador).
                  </>
                ) : null}{' '}
                A remuneração do escritório é calculada aqui; não há lançamento explícito só para isso no extrato.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={recarregar}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
            >
              <RefreshCw className="w-4 h-4" aria-hidden />
              Atualizar extrato
            </button>
            <button
              type="button"
              onClick={() =>
                navigate('/processos', {
                  state: buildRouterStateChaveClienteProcesso(padCliente(codigoStr || '1'), procStr || '1'),
                })
              }
              disabled={!vinculoOk}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-400 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              <FolderOpen className="w-4 h-4" aria-hidden />
              Abrir Processos
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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-emerald-600 bg-emerald-50 text-emerald-900 text-sm font-medium hover:bg-emerald-100 disabled:opacity-50"
            >
              <CircleDollarSign className="w-4 h-4" aria-hidden />
              Abrir Financeiro
            </button>
          </div>
        </div>
        {(carregando || erro || sucesso || salvandoRepasse || salvandoDespesa) && (
          <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-3 text-sm">
            {carregando ? <p className="text-indigo-700">Carregando painel de administração...</p> : null}
            {salvandoRepasse ? <p className="text-indigo-700">Salvando repasse...</p> : null}
            {salvandoDespesa ? <p className="text-indigo-700">Salvando despesa...</p> : null}
            {erro ? <p className="text-red-700">{erro}</p> : null}
            {sucesso ? <p className="text-emerald-700">{sucesso}</p> : null}
          </div>
        )}

        {!mock && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
            Imóvel <strong>{imovelId}</strong> sem cadastro na API ou vínculo inválido.{' '}
            <button type="button" className="underline font-medium" onClick={() => navigate('/imoveis')}>
              Voltar
            </button>
          </div>
        )}

        {mock && (
          <>
            <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-800">Vínculo obrigatório (cliente + processo)</p>
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unidade</p>
                  <p className="mt-0.5 font-medium text-slate-900 break-words">
                    {String(mock.unidade || mock.condominio || '—').trim() || '—'}
                  </p>
                  {mock.condominio && mock.unidade && String(mock.condominio).trim() !== String(mock.unidade).trim() ? (
                    <p className="text-xs text-slate-500 mt-0.5 break-words">{mock.condominio}</p>
                  ) : null}
                </div>
                <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Locador</p>
                  <p className="mt-0.5 font-medium text-slate-900 break-words">
                    {String(mock.proprietario || '—').trim() || '—'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5 font-mono tabular-nums">
                    {vinculoOk ? (
                      <>
                        Cod. {padCliente(codigoStr)} · Proc. {procStr}
                      </>
                    ) : (
                      'Cod. e Proc. não preenchidos no cadastro'
                    )}
                  </p>
                </div>
                <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Locatário</p>
                  <p className="mt-0.5 font-medium text-slate-900 break-words">
                    {String(mock.inquilino || '—').trim() || '—'}
                  </p>
                  {mock.valorLocacao || mock.diaPagAluguel ? (
                    <p className="text-xs text-slate-600 mt-0.5">
                      {mock.valorLocacao ? <>Aluguel {String(mock.valorLocacao)}</> : null}
                      {mock.valorLocacao && mock.diaPagAluguel ? ' · ' : null}
                      {mock.diaPagAluguel ? <>venc. dia {String(mock.diaPagAluguel).padStart(2, '0')}</> : null}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <span>
                  <span className="text-slate-500">Nº imóvel (planilha):</span>{' '}
                  <strong className="tabular-nums text-slate-800">{imovelId}</strong>
                </span>
                {featureFlags.useApiImoveis && mock._apiImovelId ? (
                  <span className="w-full sm:w-auto">
                    Referência API: imóvel <span className="font-mono tabular-nums">{mock._apiImovelId}</span>
                    {mock._apiContratoId != null ? (
                      <>
                        {' '}
                        · contrato vigente <span className="font-mono tabular-nums">{mock._apiContratoId}</span>
                      </>
                    ) : null}
                    {mock._apiClienteId != null ? (
                      <>
                        {' '}
                        · cliente <span className="font-mono tabular-nums">{mock._apiClienteId}</span>
                      </>
                    ) : null}
                    {mock._apiProcessoId != null ? (
                      <>
                        {' '}
                        · processo <span className="font-mono tabular-nums">{mock._apiProcessoId}</span>
                      </>
                    ) : null}
                  </span>
                ) : null}
              </div>
              {featureFlags.useApiImoveis && contratoVigenteApi ? (
                <p className="text-xs text-slate-600 mt-2 pt-2 border-t border-slate-100">
                  <strong>Contrato vigente</strong> usado para repasses/despesas: id{' '}
                  <span className="font-mono tabular-nums">{contratoVigenteApi.id}</span> · {contratoVigenteApi.status}
                  {contratoVigenteApi.dataInicio ? ` · início ${String(contratoVigenteApi.dataInicio).slice(0, 10)}` : ''}
                  {contratoVigenteApi.dataFim
                    ? ` · fim ${String(contratoVigenteApi.dataFim).slice(0, 10)}`
                    : ' · fim —'}
                  . Regra: priorizar VIGENTE com período cobrindo a data de hoje; senão VIGENTE mais recente; senão RASCUNHO;
                  ver documentação da estabilização.
                </p>
              ) : null}
              {!vinculoOk && (
                <p className="text-sm text-red-700">
                  Preencha <strong>Código</strong> e <strong>Proc.</strong> no cadastro do imóvel para liberar o financeiro
                  da locação.
                </p>
              )}
              {ehAdm && (
                <p className="text-xs text-teal-800 bg-teal-50 border border-teal-100 rounded px-2 py-1.5">
                  Processo reconhecido como <strong>administração de imóvel</strong> (par cadastro + mock). Despesas com
                  tag <code className="text-[11px]">[ADM_IMOVEL:DESPESA_REPASSAR]</code> ou classificação compatível são
                  destacadas para desconto no repasse ao locador.
                </p>
              )}
            </div>

            <ImoveisSugestoesVinculoPanel
              imovelIdContexto={vinculoOk ? imovelId : null}
              onAprovado={atualizarExtratoAposVinculo}
              estrategia="melhorPorLancamento"
              limite={50}
            />

            {!vinculoOk || !painel ? null : (
              <>
                {alertas.length > 0 && (
                  <div
                    className="rounded-lg border border-amber-300 bg-amber-50/90 p-4 space-y-2"
                    role="status"
                    aria-live="polite"
                  >
                    <p className="text-sm font-semibold text-amber-950 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
                      Alertas (conta corrente vinculada)
                    </p>
                    <ul className="list-disc pl-5 text-sm text-amber-950 space-y-1">
                      {alertas.map((a, i) => (
                        <li key={`${a.tipo}-${a.mes}-${i}`}>{a.texto}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                      Competência
                      <input
                        type="month"
                        value={competencia}
                        onChange={(e) => setCompetencia(e.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer pb-1">
                      <input
                        type="checkbox"
                        checked={modoPeriodo}
                        onChange={(e) => setModoPeriodo(e.target.checked)}
                      />
                      Resultado por período
                    </label>
                    {modoPeriodo ? (
                      <>
                        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                          De
                          <input
                            type="month"
                            value={periodoInicio}
                            onChange={(e) => setPeriodoInicio(e.target.value)}
                            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                          Até
                          <input
                            type="month"
                            value={periodoFim}
                            onChange={(e) => setPeriodoFim(e.target.value)}
                            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                          />
                        </label>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={recarregarReconciliacao}
                      className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${carregandoResultado || carregandoSugestoes ? 'animate-spin' : ''}`}
                        aria-hidden
                      />
                      Atualizar
                    </button>
                  </div>
                  {erroReconc ? <p className="text-sm text-red-700">{erroReconc}</p> : null}
                  {!contratoId ? (
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                      Sem contrato vigente na API para este imóvel — cadastre um contrato de locação para reconciliar o
                      caixa real e calcular o resultado.
                    </p>
                  ) : null}
                </div>

                {contratoId && resultado ? (
                  <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-slate-800">
                        Resultado{' '}
                        {modoPeriodo && periodoInicio && periodoFim
                          ? `· ${periodoInicio} a ${periodoFim}`
                          : `· ${competencia}`}
                      </h2>
                      {(() => {
                        const info = statusRepasseInfo(resultado.statusRepasse);
                        return (
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${info.cls}`}
                          >
                            {info.label}
                          </span>
                        );
                      })()}
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
                        titulo="Taxa efetiva × nominal"
                        valor={`${resultado.taxaEfetivaPercent != null ? Number(resultado.taxaEfetivaPercent).toFixed(2) : '—'}%`}
                        sub={`nominal ${resultado.taxaEsperadaPercent != null ? Number(resultado.taxaEsperadaPercent).toFixed(2) : '—'}%`}
                        tom="indigo"
                      />
                    </div>
                    {String(resultado.statusRepasse).toUpperCase() === 'DIVERGENTE' ? (
                      <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                        Esperado <strong>{formatBRL(repasseEsperado(resultado))}</strong> · real{' '}
                        <strong>{formatBRL(resultado.repassado)}</strong> (recebido − taxa nominal − despesas).
                      </p>
                    ) : null}
                    <p className="text-[11px] text-slate-500">
                      Números calculados <strong>somente do que foi reconciliado</strong> com o caixa — sem dedução por
                      heurística.
                    </p>
                  </div>
                ) : null}

                {contratoId ? (
                  <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-800">Reconciliação · {competencia}</h2>
                        <p className="text-xs text-slate-500">
                          Confirme o papel sugerido (ou troque) para alimentar o resultado acima. Lançamentos
                          sem processo aparecem em <strong>A adotar</strong> e são classificados (conta A + cliente +
                          processo) ao confirmar.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={salvandoReconc || selecionadas.size === 0}
                        onClick={confirmarLote}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40"
                      >
                        Confirmar selecionados ({selecionadas.size})
                      </button>
                    </div>
                    {carregandoSugestoes ? (
                      <p className="text-xs text-slate-500 py-6 text-center">Carregando sugestões…</p>
                    ) : sugestoes.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">
                        Nenhum lançamento candidato nesta competência.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Lançamentos do imóvel ({gruposReconc.doImovel.length})
                          </h3>
                          {gruposReconc.doImovel.length === 0 ? (
                            <p className="text-[11px] text-slate-400">Nenhum lançamento já no processo do imóvel.</p>
                          ) : (
                            renderTabelaReconc(gruposReconc.doImovel, false)
                          )}
                        </div>
                        {gruposReconc.aAdotar.length > 0 ? (
                          <div className="space-y-1.5">
                            <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                              A adotar · sem processo ({gruposReconc.aAdotar.length})
                            </h3>
                            <p className="text-[11px] text-amber-700">
                              Pagamentos que existem no caixa mas estão sem processo. Confirmar é uma escrita: o
                              lançamento será classificado em conta A com o cliente e o processo do imóvel.
                            </p>
                            {renderTabelaReconc(gruposReconc.aAdotar, true)}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}

                <div id="extrato-imoveis" className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 scroll-mt-4">
                  <h2 className="text-sm font-semibold text-slate-800 mb-1">Conta corrente do imóvel</h2>
                  <p className="text-xs text-slate-500 mb-3">
                    {painelFonteApi
                      ? 'Todos os lançamentos de crédito ou débito (banco e cartão) com o mesmo Cod. cliente e Proc.'
                      : 'Lista espelhada do extrato local no navegador.'}{' '}
                    Nada é ocultado por tipo: repasse, aluguel, despesa ou outro — o papel na última coluna é orientação para você classificar.
                  </p>
                  <div className="overflow-x-auto rounded border border-slate-200">
                    <table className="w-full text-left border-collapse min-w-[960px]">
                      <thead>
                        <tr>
                          <th className={th}>Data</th>
                          <th className={th}>Banco / cartão</th>
                          <th className={th}>Conta contábil</th>
                          <th className={th}>Descrição</th>
                          <th className={th}>Detalhe / classificação</th>
                          <th className={`${th} text-right`}>Valor</th>
                          <th className={th}>Papel (locação)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {painel.transacoes.length === 0 ? (
                          <tr>
                            <td colSpan={7} className={`${td} text-slate-500 text-center py-6`}>
                              Sem movimentações vinculadas.
                            </td>
                          </tr>
                        ) : (
                          painel.transacoes.map((t, idx) => {
                            const { papel, despesaRepassarAoLocador } = t.classificacao;
                            const isDesp = papel === PAPEL_DESPESA_REPASSAR || despesaRepassarAoLocador;
                            const rowClass = isDesp
                              ? 'bg-orange-50/80'
                              : papel === PAPEL_CREDITO
                                ? 'bg-emerald-50/50'
                                : papel === PAPEL_DEBITO
                                  ? 'bg-slate-50/80'
                                  : '';
                            return (
                              <tr key={`${t.apiId ?? t.numero}-${t.nomeBanco}-${t.data}-${idx}`} className={rowClass}>
                                <td className={`${td} tabular-nums whitespace-nowrap`}>{t.data}</td>
                                <td className={td}>
                                  {t.nomeBanco}
                                  {t.origemExtrato === 'cartao' ? (
                                    <span className="ml-1 text-[10px] text-slate-500">(cartão)</span>
                                  ) : null}
                                </td>
                                <td className={`${td} text-xs`}>{nomeContaPorLetra(t.letra)}</td>
                                <td className={td}>{t.descricao}</td>
                                <td className={`${td} text-xs max-w-[220px]`}>
                                  {t.descricaoDetalhada || t.categoria || '—'}
                                </td>
                                <td className={`${td} text-right tabular-nums font-medium whitespace-nowrap ${corValorNegativo(t.valor)}`}>
                                  {formatBRL(t.valor)}
                                </td>
                                <td className={td}>
                                  <span
                                    className={`inline-flex flex-col gap-0.5 text-xs ${
                                      isDesp ? 'text-orange-900 font-semibold' : 'text-slate-700'
                                    }`}
                                  >
                                    {rotuloPapelAdministracao(papel)}
                                    {isDesp && (
                                      <span className="text-[10px] font-normal uppercase tracking-wide text-orange-800">
                                        Despesa a repassar ao locador
                                      </span>
                                    )}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 space-y-4">
                  <h2 className="text-sm font-semibold text-slate-800">Operação mínima de repasses e despesas</h2>
                  <p className="text-xs text-slate-500">
                    Fonte operacional do módulo imobiliário (API de locações). O extrato financeiro acima
                    {painelFonteApi ? ' segue a API financeira' : ' usa cópia local até a API financeira estar ativa'}.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded border border-slate-200 p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-700">Novo repasse</p>
                      <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="Competência YYYY-MM" value={novoRepasse.competenciaMes} onChange={(e) => setNovoRepasse((s) => ({ ...s, competenciaMes: e.target.value }))} />
                      <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="Valor recebido" value={novoRepasse.valorRecebidoInquilino} onChange={(e) => setNovoRepasse((s) => ({ ...s, valorRecebidoInquilino: e.target.value }))} />
                      <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="Valor repassado" value={novoRepasse.valorRepassadoLocador} onChange={(e) => setNovoRepasse((s) => ({ ...s, valorRepassadoLocador: e.target.value }))} />
                      <button type="button" onClick={criarRepasseMinimo} className="px-3 py-2 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
                        Criar repasse
                      </button>
                    </div>
                    <div className="rounded border border-slate-200 p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-700">Nova despesa</p>
                      <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="Competência YYYY-MM" value={novaDespesa.competenciaMes} onChange={(e) => setNovaDespesa((s) => ({ ...s, competenciaMes: e.target.value }))} />
                      <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="Descrição" value={novaDespesa.descricao} onChange={(e) => setNovaDespesa((s) => ({ ...s, descricao: e.target.value }))} />
                      <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="Valor" value={novaDespesa.valor} onChange={(e) => setNovaDespesa((s) => ({ ...s, valor: e.target.value }))} />
                      <select
                        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                        value={novaDespesa.categoria}
                        onChange={(e) => setNovaDespesa((s) => ({ ...s, categoria: e.target.value }))}
                      >
                        <option value="OUTROS">OUTROS</option>
                        <option value="REPASSE_ADMIN">REPASSE_ADMIN</option>
                        <option value="ADMINISTRACAO">ADMINISTRACAO</option>
                      </select>
                      <button type="button" onClick={criarDespesaMinima} className="px-3 py-2 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
                        Criar despesa
                      </button>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded border border-slate-200 p-3">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Repasses (API)</p>
                      {repassesApi.length === 0 ? (
                        <p className="text-xs text-slate-500">Nenhum repasse registrado.</p>
                      ) : (
                        <ul className="space-y-2 text-xs text-slate-700 max-h-72 overflow-y-auto pr-1">
                          {repassesApi.map((r) => (
                            <li key={r.id} className="border border-slate-100 rounded p-2 bg-slate-50/80">
                              {featureFlags.useApiImoveis && repasseEditandoId === r.id && repasseDraft ? (
                                <div className="space-y-2">
                                  <input
                                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                    placeholder="Competência YYYY-MM"
                                    value={repasseDraft.competenciaMes}
                                    onChange={(e) => setRepasseDraft((s) => ({ ...s, competenciaMes: e.target.value }))}
                                    disabled={salvandoRepasse || salvandoDespesa}
                                  />
                                  <input
                                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                    placeholder="Valor recebido"
                                    value={repasseDraft.valorRecebidoInquilino}
                                    onChange={(e) => setRepasseDraft((s) => ({ ...s, valorRecebidoInquilino: e.target.value }))}
                                    disabled={salvandoRepasse || salvandoDespesa}
                                  />
                                  <input
                                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                    placeholder="Valor repassado ao locador"
                                    value={repasseDraft.valorRepassadoLocador}
                                    onChange={(e) => setRepasseDraft((s) => ({ ...s, valorRepassadoLocador: e.target.value }))}
                                    disabled={salvandoRepasse || salvandoDespesa}
                                  />
                                  <input
                                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                    placeholder="Despesas a repassar"
                                    value={repasseDraft.valorDespesasRepassar}
                                    onChange={(e) => setRepasseDraft((s) => ({ ...s, valorDespesasRepassar: e.target.value }))}
                                    disabled={salvandoRepasse || salvandoDespesa}
                                  />
                                  <input
                                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                    placeholder="Remuneração escritório"
                                    value={repasseDraft.remuneracaoEscritorio}
                                    onChange={(e) => setRepasseDraft((s) => ({ ...s, remuneracaoEscritorio: e.target.value }))}
                                    disabled={salvandoRepasse || salvandoDespesa}
                                  />
                                  <select
                                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                    value={repasseDraft.status}
                                    onChange={(e) => setRepasseDraft((s) => ({ ...s, status: e.target.value }))}
                                    disabled={salvandoRepasse || salvandoDespesa}
                                  >
                                    <option value="PENDENTE">PENDENTE</option>
                                    <option value="CONFIRMADO">CONFIRMADO</option>
                                    <option value="CANCELADO">CANCELADO</option>
                                  </select>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void salvarEdicaoRepasse()}
                                      disabled={salvandoRepasse || salvandoDespesa}
                                      className="px-2 py-1 rounded bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                      Salvar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelarEdicaoRepasse}
                                      disabled={salvandoRepasse || salvandoDespesa}
                                      className="px-2 py-1 rounded border border-slate-300 text-[11px] text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <span className="font-medium">{r.competenciaMes}</span> · recebido {formatBRL(r.valorRecebidoInquilino)} ·
                                    repasse {formatBRL(r.valorRepassadoLocador)} · status {r.status || '—'}
                                  </div>
                                  {featureFlags.useApiImoveis ? (
                                    <button
                                      type="button"
                                      onClick={() => iniciarEdicaoRepasse(r)}
                                      disabled={salvandoRepasse || salvandoDespesa || !!repasseEditandoId || !!despesaEditandoId}
                                      className="shrink-0 px-2 py-0.5 rounded border border-indigo-300 text-indigo-800 text-[11px] font-medium hover:bg-indigo-50 disabled:opacity-40"
                                    >
                                      Editar
                                    </button>
                                  ) : null}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="rounded border border-slate-200 p-3">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Despesas (API)</p>
                      <p className="text-[10px] text-slate-500 mb-2">
                        Edição via PUT (mesmo contrato). Lançamento financeiro vinculado não é editável neste formulário mínimo.
                      </p>
                      {despesasApi.length === 0 ? (
                        <p className="text-xs text-slate-500">Nenhuma despesa registrada.</p>
                      ) : (
                        <ul className="space-y-2 text-xs text-slate-700 max-h-72 overflow-y-auto pr-1">
                          {despesasApi.map((d) => (
                            <li key={d.id} className="border border-slate-100 rounded p-2 bg-slate-50/80">
                              {featureFlags.useApiImoveis && despesaEditandoId === d.id && despesaDraft ? (
                                <div className="space-y-2">
                                  <input
                                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                    placeholder="Competência YYYY-MM"
                                    value={despesaDraft.competenciaMes}
                                    onChange={(e) => setDespesaDraft((s) => ({ ...s, competenciaMes: e.target.value }))}
                                    disabled={salvandoDespesa || salvandoRepasse}
                                  />
                                  <input
                                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                    placeholder="Descrição"
                                    value={despesaDraft.descricao}
                                    onChange={(e) => setDespesaDraft((s) => ({ ...s, descricao: e.target.value }))}
                                    disabled={salvandoDespesa || salvandoRepasse}
                                  />
                                  <input
                                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                    placeholder="Valor"
                                    value={despesaDraft.valor}
                                    onChange={(e) => setDespesaDraft((s) => ({ ...s, valor: e.target.value }))}
                                    disabled={salvandoDespesa || salvandoRepasse}
                                  />
                                  <select
                                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                    value={despesaDraft.categoria}
                                    onChange={(e) => setDespesaDraft((s) => ({ ...s, categoria: e.target.value }))}
                                    disabled={salvandoDespesa || salvandoRepasse}
                                  >
                                    <option value="OUTROS">OUTROS</option>
                                    <option value="REPASSE_ADMIN">REPASSE_ADMIN</option>
                                    <option value="ADMINISTRACAO">ADMINISTRACAO</option>
                                  </select>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void salvarEdicaoDespesa()}
                                      disabled={salvandoDespesa || salvandoRepasse}
                                      className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      Salvar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelarEdicaoDespesa}
                                      disabled={salvandoDespesa || salvandoRepasse}
                                      className="px-2 py-1 rounded border border-slate-300 text-[11px] text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    {d.competenciaMes || '—'} · {d.descricao} · {formatBRL(d.valor)} · {d.categoria || '—'}
                                  </div>
                                  {featureFlags.useApiImoveis ? (
                                    <button
                                      type="button"
                                      onClick={() => iniciarEdicaoDespesa(d)}
                                      disabled={salvandoRepasse || salvandoDespesa || !!repasseEditandoId || !!despesaEditandoId}
                                      className="shrink-0 px-2 py-0.5 rounded border border-emerald-500 text-emerald-900 text-[11px] font-medium hover:bg-emerald-50 disabled:opacity-40"
                                    >
                                      Editar
                                    </button>
                                  ) : null}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
