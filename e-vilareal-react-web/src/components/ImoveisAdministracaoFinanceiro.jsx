import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Landmark,
  FolderOpen,
  CircleDollarSign,
  AlertTriangle,
} from 'lucide-react';
import { getImoveisMockTotal } from '../data/imoveisMockData.js';
import { padCliente } from '../data/processosDadosRelatorio.js';
import {
  gerarAlertasAdministracaoImovel,
  nomeContaPorLetra,
  PAPEL_DESPESA_REPASSAR,
  processoEhAdministracaoImovel,
  rotuloPapelAdministracao,
} from '../data/imoveisAdministracaoFinanceiro.js';
import {
  carregarPainelAdministracaoImovel,
  salvarDespesaLocacao,
  salvarRepasseLocacao,
} from '../repositories/imoveisRepository.js';
import { featureFlags } from '../config/featureFlags.js';

function formatBRL(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-200 bg-slate-100 whitespace-nowrap';
const td = 'px-3 py-2 text-sm text-slate-800 border-b border-slate-100 align-top';

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

  const imovelId = useMemo(() => {
    const st = location.state && typeof location.state === 'object' ? location.state : null;
    const fromState = st?.imovelId != null ? Number(st.imovelId) : NaN;
    if (Number.isFinite(fromState) && fromState >= 1) return Math.floor(fromState);
    const q = new URLSearchParams(location.search || '');
    const fromQ = Number(q.get('imovel'));
    if (Number.isFinite(fromQ) && fromQ >= 1) return Math.floor(fromQ);
    return 1;
  }, [location.state, location.search]);

  const mock = useMemo(() => imovelUi, [imovelUi]);
  const totalImoveis = getImoveisMockTotal();

  const codigoStr = mock ? String(mock.codigo ?? '').trim() : '';
  const procStr = mock ? String(mock.proc ?? '').trim() : '';
  const vinculoOk = codigoStr !== '' && procStr !== '';
  const painel = painelApi;

  const alertas = useMemo(() => {
    if (!painel || !mock) return [];
    return gerarAlertasAdministracaoImovel(mock, painel.porMes, painel.mesesOrdenados);
  }, [painel, mock]);

  const ehAdm = vinculoOk && processoEhAdministracaoImovel(codigoStr, procStr);

  const recarregar = useCallback(() => setRefreshTick((t) => t + 1), []);

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
    void carregarPainelAdministracaoImovel({ imovelId })
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
  }, [imovelId, refreshTick]);

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

  useEffect(() => {
    if (location.hash === '#extrato-imoveis') {
      const el = document.getElementById('extrato-imoveis');
      if (el) window.requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [location.hash, painel]);

  return (
    <div className="min-h-full bg-slate-200 p-4">
      <div className="max-w-[1400px] mx-auto space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate('/imoveis', { state: { imovelId } })}
              className="p-2 rounded-lg border border-slate-400 bg-white text-slate-600 hover:bg-slate-100 shrink-0 mt-0.5"
              aria-label="Voltar ao cadastro do imóvel"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Landmark className="w-6 h-6 text-teal-700 shrink-0" aria-hidden />
                Financeiro da locação
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                Movimentações são as mesmas da <strong>Conta Corrente</strong> em Processos e do módulo{' '}
                <strong>Financeiro</strong> (Cod. cliente + Proc.). A remuneração do escritório é calculada aqui; não há
                lançamento explícito só para isso no extrato.
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
                  state: { codCliente: padCliente(codigoStr || '1'), proc: procStr || '1' },
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
                      codCliente: padCliente(codigoStr || '1'),
                      proc: procStr || '1',
                      rotulo: `Imóvel ${imovelId}`,
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
            Imóvel <strong>{imovelId}</strong> sem cadastro mock (use 1 a {totalImoveis}).{' '}
            <button type="button" className="underline font-medium" onClick={() => navigate('/imoveis')}>
              Voltar
            </button>
          </div>
        )}

        {mock && (
          <>
            <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 space-y-2">
              <p className="text-sm font-semibold text-slate-800">Vínculo obrigatório (cliente + processo)</p>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <span>
                  <span className="text-slate-500">Nº imóvel:</span>{' '}
                  <strong className="tabular-nums">{imovelId}</strong>
                </span>
                <span>
                  <span className="text-slate-500">Cod. cliente (locador):</span>{' '}
                  <strong className="font-mono">{vinculoOk ? padCliente(codigoStr) : '—'}</strong>
                </span>
                <span>
                  <span className="text-slate-500">Proc.:</span>{' '}
                  <strong className="tabular-nums">{vinculoOk ? procStr : '—'}</strong>
                </span>
                <span>
                  <span className="text-slate-500">Unidade:</span> <strong>{mock.unidade}</strong>
                </span>
                {featureFlags.useApiImoveis && mock._apiImovelId ? (
                  <span className="w-full basis-full mt-1 text-xs text-slate-600">
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

                <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4">
                  <h2 className="text-sm font-semibold text-slate-800 mb-3">Consolidação mensal</h2>
                  <p className="text-xs text-slate-500 mb-3">
                    Valores derivados dos lançamentos do Financeiro. <strong>Remuneração do escritório</strong> = líquido
                    após despesas − repasse efetivo ao locador (não aparece como linha separada no extrato).
                  </p>
                  <div className="overflow-x-auto rounded border border-slate-200">
                    <table className="w-full text-left border-collapse min-w-[720px]">
                      <thead>
                        <tr>
                          <th className={th}>Mês</th>
                          <th className={`${th} text-right`}>Recebido (inquilino)</th>
                          <th className={`${th} text-right`}>Despesas (repassar)</th>
                          <th className={`${th} text-right`}>Líquido após despesas</th>
                          <th className={`${th} text-right`}>Repasse ao locador</th>
                          <th className={`${th} text-right`}>Remuneração escritório</th>
                        </tr>
                      </thead>
                      <tbody>
                        {painel.mesesOrdenados.length === 0 ? (
                          <tr>
                            <td colSpan={6} className={`${td} text-slate-500 text-center py-6`}>
                              Nenhum lançamento com este Cod. cliente e Proc. no extrato. Inclua ou vincule lançamentos no
                              Financeiro.
                            </td>
                          </tr>
                        ) : (
                          painel.mesesOrdenados.map((chave) => {
                            const row = painel.porMes.get(chave);
                            return (
                              <tr key={chave}>
                                <td className={`${td} font-medium`}>{row.label}</td>
                                <td className={`${td} text-right tabular-nums`}>{formatBRL(row.totalRecebido)}</td>
                                <td className={`${td} text-right tabular-nums text-orange-800`}>
                                  {formatBRL(row.totalDespesasRepassar)}
                                </td>
                                <td className={`${td} text-right tabular-nums`}>{formatBRL(row.liquidoAposDespesas)}</td>
                                <td className={`${td} text-right tabular-nums text-slate-800`}>
                                  {formatBRL(row.totalRepasse)}
                                </td>
                                <td className={`${td} text-right tabular-nums font-medium text-teal-800`}>
                                  {formatBRL(row.remuneracaoEscritorio)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div id="extrato-imoveis" className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 scroll-mt-4">
                  <h2 className="text-sm font-semibold text-slate-800 mb-1">Conta corrente do imóvel</h2>
                  <p className="text-xs text-slate-500 mb-3">
                    Lista espelhada do Financeiro (todos os lançamentos com o mesmo Cod. cliente e Proc.). Despesas a
                    descontar do repasse aparecem com destaque.
                  </p>
                  <div className="overflow-x-auto rounded border border-slate-200">
                    <table className="w-full text-left border-collapse min-w-[960px]">
                      <thead>
                        <tr>
                          <th className={th}>Data</th>
                          <th className={th}>Banco</th>
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
                            const rowClass = isDesp ? 'bg-orange-50/80' : '';
                            return (
                              <tr key={`${t.nomeBanco}-${t.numero}-${t.data}-${idx}`} className={rowClass}>
                                <td className={`${td} tabular-nums whitespace-nowrap`}>{t.data}</td>
                                <td className={td}>{t.nomeBanco}</td>
                                <td className={`${td} text-xs`}>{nomeContaPorLetra(t.letra)}</td>
                                <td className={td}>{t.descricao}</td>
                                <td className={`${td} text-xs max-w-[220px]`}>
                                  {t.descricaoDetalhada || t.categoria || '—'}
                                </td>
                                <td className={`${td} text-right tabular-nums font-medium`}>
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
                    Fonte operacional do módulo imobiliário (API de locações). O extrato financeiro acima permanece como conferência.
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
