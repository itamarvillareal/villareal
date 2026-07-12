import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Printer, RefreshCw, HelpCircle, X } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  listarContasBancariasClassificacaoApi,
  obterContaAcertoResumoApi,
  parearGrupoCompensacaoApi,
} from '../../../repositories/financeiroRepository.js';
import { formatMoeda } from '../shared/financeiroFormat.js';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { ExtratoDetailPanel } from '../extrato/ExtratoDetailPanel.jsx';
import { ProcessoEmbedModal } from '../../ProcessoEmbedModal.jsx';
import { AcertoFichaPanel } from './acerto/AcertoFichaPanel.jsx';
import { AcertoPeriodosView } from './acerto/AcertoPeriodosView.jsx';
import { AcertoProcessosView } from './acerto/AcertoProcessosView.jsx';
import { AcertoLancamentosView } from './acerto/AcertoLancamentosView.jsx';
import { AcertoImpressaoModal } from './acerto/AcertoImpressaoModal.jsx';
import { AcertoCardModal } from './acerto/AcertoCardModal.jsx';
import { AcertoGuiaRapido } from './acerto/AcertoGuiaRapido.jsx';
import { mostrarGuiaNovamente, isGuiaOculto } from './acerto/acertoGuiaRapido.js';
import { valorAssinadoAcerto } from './acerto/acertoUtils.js';
import {
  criarEmbedConsultaContaCorrente,
  criarEmbedConsultaProcesso,
} from './acerto/acertoConsultaRapida.js';

/**
 * Tela de trabalho "Acerto do Cliente" (Etapas 5/5b da CONTA ZERO): visão agrupada por processo,
 * lançamentos paginados com filtros, conferência persistente, compensação de seleção na tela,
 * Ficha do Acerto com fluxo Iniciar → Fechar, e impressão como modo separado.
 */
export function AcertoContaZeroPage() {
  const toast = useFinanceiroToast();
  const [contasAcerto, setContasAcerto] = useState([]);
  const [numeroBanco, setNumeroBanco] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [vinculoSel, setVinculoSel] = useState(null);
  const [aba, setAba] = useState('processos');
  const [refreshKey, setRefreshKey] = useState(0);
  const [versaoLancamentos, setVersaoLancamentos] = useState(0);

  const [selecao, setSelecao] = useState(() => new Map());
  const [compensando, setCompensando] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [cardModal, setCardModal] = useState(null);
  const [imprimindo, setImprimindo] = useState(null);
  const [periodoSel, setPeriodoSel] = useState(null);
  const [periodosResumo, setPeriodosResumo] = useState(null);
  /** Consulta rápida proc/CC — fechar só limpa o modal, sem refresh da tela. */
  const [consultaEmbed, setConsultaEmbed] = useState(null);
  const [resumoProcessos, setResumoProcessos] = useState(null);
  const [filtroSugeridoKey, setFiltroSugeridoKey] = useState(0);
  const [guiaVisivel, setGuiaVisivel] = useState(() => !isGuiaOculto());
  const trabalhoProcessosRef = useRef(null);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    listarContasBancariasClassificacaoApi({ signal: ac.signal })
      .then((lista) => {
        const acertos = (Array.isArray(lista) ? lista : []).filter((c) => c?.exigeSomaZero === true);
        setContasAcerto(acertos);
        setNumeroBanco((atual) => atual ?? (acertos[0]?.numeroBanco != null ? Number(acertos[0].numeroBanco) : 19));
      })
      .catch(() => setNumeroBanco((atual) => atual ?? 19));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || numeroBanco == null) return undefined;
    const ac = new AbortController();
    obterContaAcertoResumoApi(numeroBanco, { signal: ac.signal })
      .then((r) => setResumo(r ?? null))
      .catch((e) => {
        if (e?.name !== 'AbortError') setResumo(null);
      });
    return () => ac.abort();
  }, [numeroBanco, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((n) => n + 1);
    setVersaoLancamentos((n) => n + 1);
  }, []);

  const selecionarVinculo = useCallback((v) => {
    setVinculoSel(v);
    setSelecao(new Map());
    setDetailItem(null);
    setPeriodoSel(null);
    setPeriodosResumo(null);
    setResumoProcessos(null);
  }, []);

  const toggleSelecao = useCallback((id, lancamento) => {
    setSelecao((m) => {
      const n = new Map(m);
      if (n.has(id)) n.delete(id);
      else n.set(id, lancamento);
      return n;
    });
  }, []);

  const somaSelecao = useMemo(() => {
    let soma = 0;
    for (const l of selecao.values()) soma += valorAssinadoAcerto(l);
    return Math.round(soma * 100) / 100;
  }, [selecao]);

  const selecaoZerada = selecao.size >= 2 && Math.abs(somaSelecao) < 0.005;
  const selectedIds = useMemo(() => new Set(selecao.keys()), [selecao]);

  useEffect(() => {
    setSelecao(new Map());
  }, [periodoSel]);

  const compensarSelecao = async () => {
    if (!selecaoZerada) return;
    setCompensando(true);
    try {
      const r = await parearGrupoCompensacaoApi({ lancamentoIds: [...selecao.keys()] });
      toast.success(`Seleção compensada no grupo ${r?.grupoCompensacao ?? ''} (${selecao.size} lançamentos).`);
      setSelecao(new Map());
      refresh();
    } catch (e) {
      toast.error(e?.message || 'Falha ao compensar a seleção.');
    } finally {
      setCompensando(false);
    }
  };

  const codigoCliente = vinculoSel?.codigoCliente ? String(vinculoSel.codigoCliente).trim() : null;

  const abrirCard = useCallback((card) => {
    if (!card) return;
    setCardModal(card);
  }, []);

  const abrirConsultaProcesso = useCallback(
    ({ numeroInterno, processoId }) => {
      if (!codigoCliente) return;
      setConsultaEmbed(criarEmbedConsultaProcesso(codigoCliente, { numeroInterno, processoId }));
    },
    [codigoCliente],
  );

  const aplicarFiltroSugerido = useCallback(() => {
    setAba('processos');
    setFiltroSugeridoKey((k) => k + 1);
    setPeriodoSel((atual) => {
      const abertoIdx = periodosResumo?.periodoAbertoIndice;
      if (abertoIdx == null) return atual;
      const aberto = periodosResumo?.periodos?.[abertoIdx];
      if (aberto?.status === 'ABERTO') return abertoIdx;
      return atual;
    });
    window.requestAnimationFrame(() => {
      trabalhoProcessosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    toast.success('Filtro «só não conferidos» ativado — role até a tabela Por processo abaixo.');
  }, [periodosResumo, toast]);

  const reabrirGuia = useCallback(() => {
    mostrarGuiaNovamente();
    setGuiaVisivel(true);
  }, []);

  const abrirConsultaContaCorrente = useCallback(
    ({ numeroInterno }) => {
      if (!codigoCliente) return;
      setConsultaEmbed(criarEmbedConsultaContaCorrente(codigoCliente, { numeroInterno }));
    },
    [codigoCliente],
  );

  const periodoAtivo = useMemo(() => {
    const lista = periodosResumo?.periodos;
    if (!Array.isArray(lista) || periodoSel == null) return null;
    return lista.find((p) => p.indice === periodoSel) ?? null;
  }, [periodosResumo, periodoSel]);

  const periodoFiltro = useMemo(() => {
    if (!periodoAtivo) return { dataInicio: undefined, dataFim: undefined, somenteLeitura: false, grupoCompensacao: undefined };
    return {
      dataInicio: periodoAtivo.dataInicio ? String(periodoAtivo.dataInicio).slice(0, 10) : undefined,
      dataFim: periodoAtivo.dataFim ? String(periodoAtivo.dataFim).slice(0, 10) : undefined,
      somenteLeitura: periodoAtivo.status !== 'ABERTO',
      grupoCompensacao: periodoAtivo.grupoCompensacao ? String(periodoAtivo.grupoCompensacao) : undefined,
    };
  }, [periodoAtivo]);

  const cardsPorProc = useMemo(() => {
    const map = new Map();
    for (const p of periodosResumo?.periodos ?? []) {
      if (p.status !== 'FECHADO_GRUPO' && p.tipoPeriodo !== 'CARD') continue;
      if (p.numeroInternoProcesso == null) continue;
      const n = Number(p.numeroInternoProcesso);
      if (!map.has(n)) map.set(n, []);
      map.get(n).push(p);
    }
    return map;
  }, [periodosResumo]);

  if (!featureFlags.useApiFinanceiro) {
    return <div className="p-6 text-sm text-slate-600 dark:text-slate-400">API financeiro desativada.</div>;
  }

  const vinculos = resumo?.vinculos ?? [];
  const nomeConta =
    contasAcerto.find((c) => Number(c.numeroBanco) === Number(numeroBanco))?.bancoNome || 'CONTA ZERO';
  const clienteId = vinculoSel?.clienteId != null ? Number(vinculoSel.clienteId) : null;

  return (
    <div className="relative flex flex-col min-h-0 h-full overflow-auto p-4 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Acerto do Cliente</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {nomeConta} (conta {numeroBanco ?? '—'}) — tela de trabalho: conferência por processo,
            compensação e fechamento do acerto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {contasAcerto.length > 1 ? (
            <select
              value={numeroBanco ?? ''}
              onChange={(e) => {
                setNumeroBanco(Number(e.target.value));
                selecionarVinculo(null);
              }}
              className="text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
            >
              {contasAcerto.map((c) => (
                <option key={c.numeroBanco} value={c.numeroBanco}>
                  {c.bancoNome} ({c.numeroBanco})
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={reabrirGuia}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Reabrir guia «Como usar esta tela»"
          >
            <HelpCircle className="w-4 h-4" />
            Guia
          </button>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button
            type="button"
            disabled={!clienteId}
            onClick={() => setImprimindo({ visaoCliente: true })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            title="Extrato do cliente (visível ao cliente, com saldo acumulado)"
          >
            <Printer className="w-4 h-4" />
            Imprimir (cliente)
          </button>
          <button
            type="button"
            disabled={!clienteId}
            onClick={() => setImprimindo({ visaoCliente: false })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            title="Extrato interno completo, com valores reais"
          >
            <Printer className="w-4 h-4" />
            Imprimir (interno)
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 min-h-0">
        <aside className="lg:w-80 shrink-0">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <p className="px-3 py-2 text-xs font-medium text-slate-500 border-b border-slate-100 dark:border-slate-800">
              Clientes com movimento na conta
            </p>
            {vinculos.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500">Nenhum vínculo com lançamentos.</p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {vinculos.map((v) => {
                  const chave = v.clienteId != null ? `cli-${v.clienteId}` : `pes-${v.pessoaRefId}`;
                  const ativo =
                    vinculoSel &&
                    ((v.clienteId != null && Number(vinculoSel.clienteId) === Number(v.clienteId)) ||
                      (v.clienteId == null && Number(vinculoSel.pessoaRefId) === Number(v.pessoaRefId)));
                  const pendente = Math.abs(Number(v.saldoPendente ?? 0)) >= 0.005 || Number(v.pendentes) > 0;
                  return (
                    <li key={chave}>
                      <button
                        type="button"
                        disabled={v.clienteId == null}
                        onClick={() => selecionarVinculo(v)}
                        title={v.clienteId == null ? 'Vínculo por pessoa/imóvel — use o extrato interno' : undefined}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-950/30 disabled:opacity-60 ${
                          ativo ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''
                        }`}
                      >
                        <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                          {String(v.nome ?? '').trim() ||
                            (v.codigoCliente ? `Cliente ${v.codigoCliente}` : `Pessoa ${v.pessoaRefId}`)}
                        </p>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          {Number(v.totalLancamentos).toLocaleString('pt-BR')} lanç. · saldo{' '}
                          {formatMoeda(Number(v.saldo ?? 0))}
                          {pendente ? (
                            <span className="ml-1 text-amber-700 dark:text-amber-300">
                              · {Number(v.pendentes).toLocaleString('pt-BR')} pend. ({formatMoeda(Number(v.saldoPendente ?? 0))})
                            </span>
                          ) : null}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 space-y-3">
          {!clienteId ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Selecione um cliente para trabalhar o acerto.
            </p>
          ) : (
            <>
              <AcertoFichaPanel
                clienteId={clienteId}
                numeroBanco={numeroBanco}
                refreshKey={refreshKey}
                onAcertoFechado={refresh}
                onConfigSalva={refresh}
              />

              {guiaVisivel ? (
                <AcertoGuiaRapido
                  periodosResumo={periodosResumo}
                  resumoProcessos={resumoProcessos}
                  periodoAtivo={periodoAtivo}
                  onAplicarFiltroSugerido={aplicarFiltroSugerido}
                  onDispensar={() => setGuiaVisivel(false)}
                />
              ) : null}

              <AcertoPeriodosView
                numeroBanco={numeroBanco}
                clienteId={clienteId}
                refreshKey={refreshKey}
                periodoSel={periodoSel}
                onSelecionarPeriodo={setPeriodoSel}
                onAbrirCard={abrirCard}
                onResumoCarregado={setPeriodosResumo}
              />

              <div
                id="acerto-trabalho-processos"
                ref={trabalhoProcessosRef}
                className="scroll-mt-4 space-y-3 rounded-lg ring-offset-2 focus-within:ring-2 focus-within:ring-sky-400/40"
              >
              <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700">
                {[
                  { id: 'processos', label: 'Por processo' },
                  { id: 'lancamentos', label: 'Lançamentos' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAba(t.id)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                      aba === t.id
                        ? 'border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {aba === 'processos' ? (
                <AcertoProcessosView
                  numeroBanco={numeroBanco}
                  clienteId={clienteId}
                  refreshKey={refreshKey}
                  onRefresh={refresh}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelecao}
                  onAbrirLancamento={setDetailItem}
                  versaoLancamentos={versaoLancamentos}
                  periodoDataInicio={periodoFiltro.dataInicio}
                  periodoDataFim={periodoFiltro.dataFim}
                  periodoGrupoCompensacao={periodoFiltro.grupoCompensacao}
                  somenteLeitura={periodoFiltro.somenteLeitura}
                  cardsPorProc={cardsPorProc}
                  onAbrirCard={abrirCard}
                  codigoCliente={codigoCliente}
                  onAbrirConsultaProcesso={abrirConsultaProcesso}
                  onAbrirConsultaContaCorrente={abrirConsultaContaCorrente}
                  onResumoCarregado={setResumoProcessos}
                  filtroSugeridoKey={filtroSugeridoKey}
                  onAplicarFiltroSugerido={aplicarFiltroSugerido}
                />
              ) : (
                <AcertoLancamentosView
                  numeroBanco={numeroBanco}
                  clienteId={clienteId}
                  refreshKey={refreshKey}
                  onRefresh={refresh}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelecao}
                  onAbrirLancamento={setDetailItem}
                  versaoLancamentos={versaoLancamentos}
                  periodoDataInicio={periodoFiltro.dataInicio}
                  periodoDataFim={periodoFiltro.dataFim}
                  periodoGrupoCompensacao={periodoFiltro.grupoCompensacao}
                  somenteLeitura={periodoFiltro.somenteLeitura}
                />
              )}
              </div>
            </>
          )}
        </main>
      </div>

      {selecao.size > 0 && !periodoFiltro.somenteLeitura ? (
        <div className="sticky bottom-2 z-20 mx-auto flex flex-wrap items-center gap-3 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-lg px-4 py-2 text-sm">
          <span>
            <strong>{selecao.size}</strong> selecionado(s) · soma{' '}
            <strong className={Math.abs(somaSelecao) < 0.005 ? 'text-emerald-600' : 'text-amber-700 dark:text-amber-300'}>
              {formatMoeda(somaSelecao)}
            </strong>
          </span>
          <button
            type="button"
            disabled={!selecaoZerada || compensando}
            onClick={() => void compensarSelecao()}
            title={
              selecaoZerada
                ? 'Compensa os lançamentos selecionados em um grupo de soma zero'
                : 'A seleção precisa ter 2+ lançamentos somando zero'
            }
            className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Link2 className="w-3.5 h-3.5" />
            {compensando ? 'Compensando…' : 'Compensar seleção'}
          </button>
          <button
            type="button"
            onClick={() => setSelecao(new Map())}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <X className="w-3 h-3" /> Limpar
          </button>
        </div>
      ) : null}

      {detailItem ? (
        <div className={cardModal ? 'fixed inset-0 z-[85]' : 'absolute inset-0 z-10'}>
          <button
            type="button"
            className="absolute inset-0 bg-black/20"
            aria-label="Fechar painel"
            onClick={() => setDetailItem(null)}
          />
          <ExtratoDetailPanel
            item={detailItem}
            onClose={() => setDetailItem(null)}
            onSaved={(updated) => {
              setDetailItem(updated);
              setVersaoLancamentos((n) => n + 1);
            }}
            onDeleted={() => {
              setDetailItem(null);
              refresh();
            }}
          />
        </div>
      ) : null}

      {cardModal ? (
        <AcertoCardModal
          card={cardModal}
          numeroBanco={numeroBanco}
          clienteId={clienteId}
          codigoCliente={codigoCliente}
          refreshKey={refreshKey}
          onClose={() => setCardModal(null)}
          onAbrirLancamento={setDetailItem}
          onAbrirConsultaProcesso={abrirConsultaProcesso}
          onAbrirConsultaContaCorrente={abrirConsultaContaCorrente}
        />
      ) : null}

      {imprimindo && clienteId ? (
        <AcertoImpressaoModal
          numeroBanco={numeroBanco}
          clienteId={clienteId}
          nomeCliente={`${vinculoSel?.nome ?? ''}${vinculoSel?.codigoCliente ? ` (${vinculoSel.codigoCliente})` : ''}`}
          nomeConta={nomeConta}
          visaoCliente={imprimindo.visaoCliente}
          onClose={() => setImprimindo(null)}
        />
      ) : null}

      <ProcessoEmbedModal
        embed={consultaEmbed}
        onFechar={() => setConsultaEmbed(null)}
        titulo={consultaEmbed?.titulo ?? 'Consulta rápida'}
      />
    </div>
  );
}
