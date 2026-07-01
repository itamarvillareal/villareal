import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { Banknote, CalendarClock, ChevronDown, ChevronUp, History, Loader2, RefreshCw, Rocket, Search } from 'lucide-react';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import {
  labelStatusContatoWhatsApp,
  resumoUltimoContato,
  statusBadgeContatoWhatsApp,
} from './ProcessoWhatsAppContatosSecao.jsx';
import {
  agendarCobrancas,
  cancelarCobrancasAgendadas,
  dispararCobrancas,
  getClientesEscritorioCobranca,
  getCobrancaLoteDetalhes,
  getCobrancaLotes,
  getCobrancaPreview,
  getCobrancaStats,
  getCondominiosCobranca,
  reenviarCobrancasFalhas,
} from '../../repositories/whatsappRepository.js';
import {
  datetimeLocalToIso,
  defaultDatetimeLocalTomorrowAt,
  formatDateTimeBR,
  isFutureDatetimeLocal,
} from '../../utils/whatsappFormat.js';
import { processosBtnPrimary, processosBtnSecondary, processosInputClass } from '../processos/ProcessosAdminLayout.jsx';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const TEMPLATE_COBRANCA = 'cobranca_pagamento';

function statusBadgeClass(status) {
  const s = String(status ?? '').toUpperCase();
  if (s === 'ENTREGUE' || s === 'LIDO') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (s === 'ENVIADO') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
  if (s === 'AGENDADO') return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200';
  if (s === 'FALHOU') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  if (s === 'CANCELADO') return 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function itemKey(item) {
  if (item.processoId != null) return `proc-${item.processoId}`;
  return String(item.imovelId ?? item.pessoaId ?? item.telefone);
}

function formatCodigoCliente(cod) {
  const n = Number(String(cod ?? '').replace(/\D/g, ''));
  if (!Number.isFinite(n) || n < 1) return String(cod ?? '');
  return String(n);
}

export function WhatsAppCobrancas() {
  const toast = useWhatsAppToast();
  const [tab, setTab] = useState('nova');
  const [step, setStep] = useState(1);
  const [modoOrigem, setModoOrigem] = useState('cliente');
  const [condominios, setCondominios] = useState([]);
  const [clientesEscritorio, setClientesEscritorio] = useState([]);
  const [condominioId, setCondominioId] = useState('');
  const [clienteEscritorioCodigo, setClienteEscritorioCodigo] = useState('');
  const [preview, setPreview] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loteDescricao, setLoteDescricao] = useState('');
  const [modoEnvio, setModoEnvio] = useState('agendar');
  const [scheduledAtLocal, setScheduledAtLocal] = useState(() => defaultDatetimeLocalTomorrowAt(8, 0));
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [stats, setStats] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [lotesPage, setLotesPage] = useState(0);
  const [lotesTotalPages, setLotesTotalPages] = useState(0);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [expandedLote, setExpandedLote] = useState(null);
  const [detalhesLote, setDetalhesLote] = useState([]);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [expandedHistoricoKey, setExpandedHistoricoKey] = useState(null);

  const condominioSelecionado = useMemo(
    () => condominios.find((c) => String(c.id) === String(condominioId)),
    [condominios, condominioId],
  );

  const clienteEscritorioSelecionado = useMemo(
    () => clientesEscritorio.find((c) => String(c.codigoCliente) === String(clienteEscritorioCodigo)),
    [clientesEscritorio, clienteEscritorioCodigo],
  );

  const tituloOrigem = useMemo(() => {
    if (modoOrigem === 'cliente' && clienteEscritorioSelecionado) {
      return `${formatCodigoCliente(clienteEscritorioSelecionado.codigoCliente)} — ${clienteEscritorioSelecionado.nome}`;
    }
    if (modoOrigem === 'condominio' && condominioSelecionado) {
      return condominioSelecionado.nome;
    }
    return 'Cobrança';
  }, [modoOrigem, clienteEscritorioSelecionado, condominioSelecionado]);

  const selectedItems = useMemo(
    () => preview.filter((p) => selected.has(itemKey(p))),
    [preview, selected],
  );

  const valorTotalSelecionado = useMemo(() => {
    return selectedItems.reduce((acc, p) => acc + Number(p.valorPendente ?? 0), 0);
  }, [selectedItems]);

  const semTelefoneCount = preview.filter((p) => !p.temTelefone).length;
  const jaCobradosCount = preview.filter((p) => p.jaCobradoEsteMes).length;

  const loadStats = useCallback(async () => {
    try {
      const s = await getCobrancaStats();
      setStats(s);
    } catch {
      setStats(null);
    }
  }, []);

  const loadLotes = useCallback(async (page = 0, append = false) => {
    setLoadingLotes(true);
    try {
      const res = await getCobrancaLotes(page, 10);
      const chunk = Array.isArray(res?.content) ? res.content : [];
      setLotes((prev) => (append ? [...prev, ...chunk] : chunk));
      setLotesPage(page);
      setLotesTotalPages(Number(res?.totalPages ?? 0));
    } catch (err) {
      toast.error(err?.message || 'Erro ao carregar histórico.');
    } finally {
      setLoadingLotes(false);
    }
  }, [toast]);

  useEffect(() => {
    void getCondominiosCobranca()
      .then((rows) => setCondominios(Array.isArray(rows) ? rows : []))
      .catch(() => setCondominios([]));
    void getClientesEscritorioCobranca()
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setClientesEscritorio(list);
        const piloto = list.find((c) => formatCodigoCliente(c.codigoCliente) === '299');
        if (piloto) setClienteEscritorioCodigo(piloto.codigoCliente);
      })
      .catch(() => setClientesEscritorio([]));
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === 'historico') void loadLotes(0, false);
  }, [tab, loadLotes]);

  const montarItensPayload = () =>
    selectedItems.map((p) => ({
      imovelId: p.imovelId ?? null,
      clienteId: p.clienteId ?? null,
      pessoaId: p.pessoaId,
      pessoaNome: p.pessoaNome,
      telefone: p.telefone,
      condominioNome: p.condominioNome,
      unidadeDescricao: p.unidadeDescricao,
      processoId: p.processoId,
      valorPendente: p.valorPendente ?? 0,
    }));

  const buscarPreview = async () => {
    if (modoOrigem === 'condominio' && !condominioId) {
      toast.error('Selecione um condomínio.');
      return;
    }
    if (modoOrigem === 'cliente' && !clienteEscritorioCodigo) {
      toast.error('Selecione o cliente do escritório.');
      return;
    }
    setLoadingPreview(true);
    try {
      const rows =
        modoOrigem === 'cliente'
          ? await getCobrancaPreview({ clienteEscritorioCodigo })
          : await getCobrancaPreview({ condominioId: Number(condominioId) });
      const list = Array.isArray(rows) ? rows : [];
      setPreview(list);
      setExpandedHistoricoKey(null);
      const auto = new Set();
      for (const p of list) {
        if (p.temTelefone && !p.jaCobradoEsteMes) auto.add(itemKey(p));
      }
      setSelected(auto);
      const now = new Date();
      const mesAno = `${tituloOrigem} - ${MESES[now.getMonth()]}/${now.getFullYear()}`;
      setLoteDescricao(`Cobrança ${mesAno}`);
      setStep(2);
    } catch (err) {
      toast.error(err?.message || 'Erro ao buscar unidades.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const toggleAllComTelefone = () => {
    const keys = preview.filter((p) => p.temTelefone).map(itemKey);
    const allSelected = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const executarEnvio = async () => {
    if (selectedItems.length === 0) {
      toast.error('Selecione ao menos uma unidade.');
      return;
    }
    if (modoEnvio === 'agendar' && !isFutureDatetimeLocal(scheduledAtLocal)) {
      toast.error('Informe data e hora no futuro para o agendamento.');
      return;
    }
    setDisparando(true);
    setStep(3);
    try {
      const itens = montarItensPayload();
      if (modoEnvio === 'agendar') {
        const scheduledAt = datetimeLocalToIso(scheduledAtLocal);
        const res = await agendarCobrancas(itens, loteDescricao, scheduledAt);
        setResultado({ ...res, tipo: 'agendado' });
        toast.success(
          `${res?.agendados ?? 0} cobrança(s) agendadas para ${formatDateTimeBR(res?.scheduledAt)}.`,
        );
      } else {
        const res = await dispararCobrancas(itens, loteDescricao);
        setResultado({ ...res, tipo: 'imediato' });
        toast.success(`Lote enviado: ${res?.enviados ?? 0} ok, ${res?.falhos ?? 0} falhas.`);
      }
      void loadStats();
    } catch (err) {
      toast.error(err?.message || 'Erro ao processar cobranças.');
      setStep(2);
    } finally {
      setDisparando(false);
    }
  };

  const expandirLote = async (loteId) => {
    if (expandedLote === loteId) {
      setExpandedLote(null);
      return;
    }
    setExpandedLote(loteId);
    setLoadingDetalhes(true);
    try {
      const rows = await getCobrancaLoteDetalhes(loteId);
      setDetalhesLote(Array.isArray(rows) ? rows : []);
    } catch {
      setDetalhesLote([]);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const handleReenviar = async (loteId) => {
    try {
      const res = await reenviarCobrancasFalhas(loteId);
      toast.success(`${res?.reenviados ?? 0} cobrança(s) reenviada(s).`);
      if (expandedLote === loteId) void expandirLote(loteId);
      void loadLotes(lotesPage, false);
      void loadStats();
    } catch (err) {
      toast.error(err?.message || 'Erro ao reenviar.');
    }
  };

  const handleCancelarAgendado = async (loteId) => {
    if (!window.confirm('Cancelar todas as cobranças ainda agendadas deste lote?')) return;
    try {
      const res = await cancelarCobrancasAgendadas(loteId);
      toast.success(`${res?.cancelados ?? 0} agendamento(s) cancelado(s).`);
      if (expandedLote === loteId) void expandirLote(loteId);
      void loadLotes(lotesPage, false);
    } catch (err) {
      toast.error(err?.message || 'Erro ao cancelar agendamento.');
    }
  };

  const loteTemAgendados = (lote) => Number(lote?.pendentes ?? 0) > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={tab === 'nova' ? processosBtnPrimary : processosBtnSecondary} onClick={() => setTab('nova')}>
          Nova Cobrança
        </button>
        <button type="button" className={tab === 'historico' ? processosBtnPrimary : processosBtnSecondary} onClick={() => setTab('historico')}>
          Histórico
        </button>
      </div>

      {stats ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-sm text-slate-700 dark:text-slate-300">
          Este mês: <strong>{stats.enviadasEsteMes ?? 0}</strong> enviadas ·{' '}
          <strong>{stats.entreguesEsteMes ?? 0}</strong> entregues ·{' '}
          <strong>{Math.round(stats.taxaEntrega ?? 0)}%</strong> taxa ·{' '}
          <strong>{Number(stats.valorTotalCobradoMes ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
        </div>
      ) : null}

      {tab === 'nova' ? (
        <>
          {step === 1 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Banknote className="h-5 w-5 text-emerald-600" />
                Nova Cobrança em Lote
              </h2>
              <p className="text-xs text-slate-500">
                Template: <strong className="text-slate-700">{TEMPLATE_COBRANCA}</strong> (nome, unidade, condomínio)
              </p>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Origem das unidades</legend>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="origem-cobranca"
                    checked={modoOrigem === 'cliente'}
                    onChange={() => setModoOrigem('cliente')}
                  />
                  Cliente do escritório (processos com unidade)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="origem-cobranca"
                    checked={modoOrigem === 'condominio'}
                    onChange={() => setModoOrigem('condominio')}
                  />
                  Condomínio (imóveis com pendência financeira)
                </label>
              </fieldset>

              {modoOrigem === 'cliente' ? (
                <label className="block text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Cliente</span>
                  <select
                    className={`${processosInputClass} mt-1 w-full`}
                    value={clienteEscritorioCodigo}
                    onChange={(e) => setClienteEscritorioCodigo(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {clientesEscritorio.map((c) => (
                      <option key={c.codigoCliente} value={c.codigoCliente}>
                        {formatCodigoCliente(c.codigoCliente)} — {c.nome} ({c.totalUnidades} un.)
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Condomínio</span>
                  <select className={`${processosInputClass} mt-1 w-full`} value={condominioId} onChange={(e) => setCondominioId(e.target.value)}>
                    <option value="">Selecione…</option>
                    {condominios.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} ({c.totalUnidades} un.)
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button type="button" className={processosBtnPrimary} disabled={loadingPreview} onClick={() => void buscarPreview()}>
                {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : <Search className="h-4 w-4 inline mr-2" />}
                Buscar unidades
              </button>
            </div>
          ) : null}

          {step >= 2 && preview.length > 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{tituloOrigem} — {preview.length} unidade(s)</h3>
                  <button type="button" className="text-xs text-emerald-700 dark:text-emerald-400 mt-1" onClick={toggleAllComTelefone}>
                    Selecionar todas com telefone
                  </button>
                </div>
                <button type="button" className={processosBtnSecondary} onClick={() => setStep(1)}>
                  ← Voltar
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-2 w-8" />
                      <th className="p-2">Cliente / Réu</th>
                      <th className="p-2">Unidade</th>
                      <th className="p-2">Proc.</th>
                      <th className="p-2">Telefone</th>
                      <th className="p-2">Contato</th>
                      <th className="p-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p) => {
                      const key = itemKey(p);
                      const disabled = !p.temTelefone;
                      const historico = Array.isArray(p.historicoContatos) ? p.historicoContatos : [];
                      const resumo = resumoUltimoContato(historico);
                      const historicoAberto = expandedHistoricoKey === key;
                      return (
                        <Fragment key={key}>
                        <tr className="border-t border-slate-100 dark:border-slate-800">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selected.has(key)}
                              disabled={disabled}
                              onChange={() => {
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(key)) next.delete(key);
                                  else next.add(key);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td className="p-2">{p.pessoaNome}</td>
                          <td className="p-2">{p.unidadeDescricao}</td>
                          <td className="p-2 tabular-nums">{p.processoNumeroInterno ?? '—'}</td>
                          <td className="p-2">
                            {!p.temTelefone ? <span className="text-amber-600 text-xs">Sem tel</span> : null}
                            {p.jaCobradoEsteMes ? <span className="text-slate-500 text-xs ml-1">Já cobrado</span> : null}
                            {p.temTelefone ? p.telefoneFormatado : '—'}
                          </td>
                          <td className="p-2">
                            {resumo ? (
                              <div className="space-y-0.5">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusBadgeContatoWhatsApp(resumo.status)}`}>
                                  {labelStatusContatoWhatsApp(resumo.status)}
                                </span>
                                <p className="text-[10px] text-slate-500 tabular-nums">{formatDateTimeBR(resumo.quando)}</p>
                                {resumo.total > 1 ? (
                                  <p className="text-[10px] text-slate-400">{resumo.total} envios no total</p>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Nunca contactado</span>
                            )}
                          </td>
                          <td className="p-2">
                            {historico.length > 0 ? (
                              <button
                                type="button"
                                className="text-slate-500 hover:text-emerald-700"
                                title="Ver histórico de contatos"
                                onClick={() => setExpandedHistoricoKey(historicoAberto ? null : key)}
                              >
                                <History className="h-4 w-4" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                        {historicoAberto ? (
                          <tr className="border-t border-slate-100 bg-slate-50/80 dark:bg-slate-800/40">
                            <td colSpan={7} className="p-3">
                              <p className="text-xs font-semibold text-slate-600 mb-2">Histórico de cobranças — {p.pessoaNome}</p>
                              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:bg-slate-900">
                                <table className="w-full text-xs">
                                  <thead className="text-left text-slate-500 uppercase">
                                    <tr>
                                      <th className="p-2">Quando</th>
                                      <th className="p-2">Status</th>
                                      <th className="p-2">Telefone</th>
                                      <th className="p-2">Lote</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {historico.map((h) => (
                                      <tr key={h.id} className="border-t border-slate-100">
                                        <td className="p-2 tabular-nums whitespace-nowrap">
                                          {formatDateTimeBR(h.quando ?? h.enviadoAt ?? h.scheduledAt ?? h.createdAt)}
                                        </td>
                                        <td className="p-2">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusBadgeContatoWhatsApp(h.status)}`}>
                                            {labelStatusContatoWhatsApp(h.status)}
                                          </span>
                                        </td>
                                        <td className="p-2">{h.telefoneFormatado ?? '—'}</td>
                                        <td className="p-2 max-w-[200px] truncate" title={h.loteDescricao}>{h.loteDescricao || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                <p className="text-xs text-slate-500">
                  Selecionados: {selectedItems.length} · Sem tel: {semTelefoneCount} · Já cobrados: {jaCobradosCount}
                  {modoOrigem === 'condominio' ? (
                    <>
                      {' '}
                      · Total: {valorTotalSelecionado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </>
                  ) : null}
                </p>
                <input className={`${processosInputClass} w-full`} value={loteDescricao} onChange={(e) => setLoteDescricao(e.target.value)} placeholder="Descrição do lote" />

                <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                  <legend className="text-xs font-semibold text-slate-600 px-1">Quando enviar</legend>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="modo-envio" checked={modoEnvio === 'agendar'} onChange={() => setModoEnvio('agendar')} />
                    Agendar envio
                  </label>
                  {modoEnvio === 'agendar' ? (
                    <input
                      type="datetime-local"
                      className={`${processosInputClass} w-full max-w-xs`}
                      value={scheduledAtLocal}
                      onChange={(e) => setScheduledAtLocal(e.target.value)}
                    />
                  ) : null}
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="modo-envio" checked={modoEnvio === 'agora'} onChange={() => setModoEnvio('agora')} />
                    Disparar agora
                  </label>
                </fieldset>

                {step === 2 ? (
                  <button type="button" className={processosBtnPrimary} disabled={disparando} onClick={() => void executarEnvio()}>
                    {modoEnvio === 'agendar' ? (
                      <CalendarClock className="h-4 w-4 inline mr-2" />
                    ) : (
                      <Rocket className="h-4 w-4 inline mr-2" />
                    )}
                    {modoEnvio === 'agendar' ? 'Agendar cobranças' : 'Disparar cobranças'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 2 && preview.length === 0 && !loadingPreview ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              Nenhuma unidade encontrada para os critérios selecionados.
            </div>
          ) : null}

          {step === 3 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3">
              {disparando ? (
                <p className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Processando…
                </p>
              ) : resultado ? (
                <>
                  {resultado.tipo === 'agendado' ? (
                    <p className="text-sm">
                      📅 <strong>{resultado.agendados}</strong> mensagem(ns) agendada(s) para{' '}
                      <strong>{formatDateTimeBR(resultado.scheduledAt)}</strong>
                      {resultado.semTelefone > 0 ? (
                        <span className="text-amber-700"> · {resultado.semTelefone} sem telefone</span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-sm">
                      ✅ Enviados: <strong>{resultado.enviados}</strong> · ❌ Falhos: <strong>{resultado.falhos}</strong>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {resultado.tipo === 'imediato' && resultado.falhos > 0 ? (
                      <button type="button" className={processosBtnSecondary} onClick={() => void handleReenviar(resultado.loteId)}>
                        <RefreshCw className="h-4 w-4 inline mr-1" /> Reenviar falhos
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={processosBtnPrimary}
                      onClick={() => {
                        setTab('historico');
                        setStep(1);
                        setPreview([]);
                        setResultado(null);
                      }}
                    >
                      Ver histórico
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-3">
          {lotes.map((lote) => (
            <div key={lote.loteId} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{lote.loteDescricao || lote.loteId}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Total: {lote.total} · ✅ {lote.enviados} · ❌ {lote.falhos} · ⏳ {lote.pendentes}
                    {loteTemAgendados(lote) ? <span className="text-violet-700 ml-1">(incl. agendados)</span> : null}
                  </p>
                </div>
                <div className="flex gap-2">
                  {loteTemAgendados(lote) ? (
                    <button type="button" className={processosBtnSecondary} onClick={() => void handleCancelarAgendado(lote.loteId)}>
                      Cancelar agendados
                    </button>
                  ) : null}
                  {lote.falhos > 0 ? (
                    <button type="button" className={processosBtnSecondary} onClick={() => void handleReenviar(lote.loteId)}>
                      Reenviar falhos
                    </button>
                  ) : null}
                  <button type="button" className={processosBtnSecondary} onClick={() => void expandirLote(lote.loteId)}>
                    {expandedLote === lote.loteId ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {expandedLote === lote.loteId ? (
                loadingDetalhes ? (
                  <Loader2 className="h-5 w-5 animate-spin mt-3" />
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="p-1">Nome</th>
                          <th className="p-1">Unidade</th>
                          <th className="p-1">Proc.</th>
                          <th className="p-1">Telefone</th>
                          <th className="p-1">Enviado / agendado</th>
                          <th className="p-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalhesLote.map((d) => (
                          <tr key={d.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="p-1">{d.pessoaNome}</td>
                            <td className="p-1">{d.unidadeDescricao}</td>
                            <td className="p-1 tabular-nums">{d.processoNumeroInterno ?? '—'}</td>
                            <td className="p-1">{d.phoneNumber}</td>
                            <td className="p-1 tabular-nums whitespace-nowrap">
                              {formatDateTimeBR(d.enviadoAt ?? d.scheduledAt ?? d.createdAt)}
                            </td>
                            <td className="p-1">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusBadgeClass(d.status)}`}>{d.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}
            </div>
          ))}
          {lotesPage + 1 < lotesTotalPages ? (
            <button type="button" className={processosBtnSecondary} disabled={loadingLotes} onClick={() => void loadLotes(lotesPage + 1, true)}>
              Carregar mais…
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
