import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, ChevronDown, ChevronUp, Loader2, RefreshCw, Rocket, Search } from 'lucide-react';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import {
  dispararCobrancas,
  getCobrancaLoteDetalhes,
  getCobrancaLotes,
  getCobrancaPreview,
  getCobrancaStats,
  getCondominiosCobranca,
  reenviarCobrancasFalhas,
} from '../../repositories/whatsappRepository.js';
import { processosBtnPrimary, processosBtnSecondary, processosInputClass } from '../processos/ProcessosAdminLayout.jsx';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function statusBadgeClass(status) {
  const s = String(status ?? '').toUpperCase();
  if (s === 'ENTREGUE' || s === 'LIDO') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (s === 'ENVIADO') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
  if (s === 'FALHOU') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function itemKey(item) {
  return String(item.imovelId ?? item.pessoaId ?? item.telefone);
}

export function WhatsAppCobrancas() {
  const toast = useWhatsAppToast();
  const [tab, setTab] = useState('nova');
  const [step, setStep] = useState(1);
  const [condominios, setCondominios] = useState([]);
  const [condominioId, setCondominioId] = useState('');
  const [preview, setPreview] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loteDescricao, setLoteDescricao] = useState('');
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

  const condominioSelecionado = useMemo(
    () => condominios.find((c) => String(c.id) === String(condominioId)),
    [condominios, condominioId],
  );

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
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === 'historico') void loadLotes(0, false);
  }, [tab, loadLotes]);

  const buscarPreview = async () => {
    if (!condominioId) {
      toast.error('Selecione um condomínio.');
      return;
    }
    setLoadingPreview(true);
    try {
      const rows = await getCobrancaPreview({ condominioId: Number(condominioId) });
      const list = Array.isArray(rows) ? rows : [];
      setPreview(list);
      const auto = new Set();
      for (const p of list) {
        if (p.temTelefone && !p.jaCobradoEsteMes) auto.add(itemKey(p));
      }
      setSelected(auto);
      const now = new Date();
      const mesAno = `${condominioSelecionado?.nome ?? 'Condomínio'} - ${MESES[now.getMonth()]}/${now.getFullYear()}`;
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

  const disparar = async () => {
    if (selectedItems.length === 0) {
      toast.error('Selecione ao menos uma unidade.');
      return;
    }
    setDisparando(true);
    setStep(3);
    try {
      const itens = selectedItems.map((p) => ({
        imovelId: p.imovelId,
        clienteId: p.clienteId,
        pessoaId: p.pessoaId,
        pessoaNome: p.pessoaNome,
        telefone: p.telefone,
        condominioNome: p.condominioNome,
        unidadeDescricao: p.unidadeDescricao,
        processoId: p.processoId,
        valorPendente: p.valorPendente,
      }));
      const res = await dispararCobrancas(itens, loteDescricao);
      setResultado(res);
      toast.success(`Lote enviado: ${res?.enviados ?? 0} ok, ${res?.falhos ?? 0} falhas.`);
      void loadStats();
    } catch (err) {
      toast.error(err?.message || 'Erro ao disparar cobranças.');
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
              <button type="button" className={processosBtnPrimary} disabled={loadingPreview} onClick={() => void buscarPreview()}>
                {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : <Search className="h-4 w-4 inline mr-2" />}
                Buscar unidades com pendência
              </button>
            </div>
          ) : null}

          {step >= 2 && preview.length > 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{condominioSelecionado?.nome} — {preview.length} unidade(s)</h3>
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
                      <th className="p-2">Cliente</th>
                      <th className="p-2">Unidade</th>
                      <th className="p-2">Valor</th>
                      <th className="p-2">Telefone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p) => {
                      const key = itemKey(p);
                      const disabled = !p.temTelefone;
                      return (
                        <tr key={key} className="border-t border-slate-100 dark:border-slate-800">
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
                          <td className="p-2">{p.valorPendenteFormatado}</td>
                          <td className="p-2">
                            {!p.temTelefone ? <span className="text-amber-600 text-xs">Sem tel</span> : null}
                            {p.jaCobradoEsteMes ? <span className="text-slate-500 text-xs ml-1">Já cobrado</span> : null}
                            {p.temTelefone ? p.telefoneFormatado : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                <p className="text-xs text-slate-500">
                  Selecionados: {selectedItems.length} · Sem tel: {semTelefoneCount} · Já cobrados: {jaCobradosCount} · Total:{' '}
                  {valorTotalSelecionado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <input className={`${processosInputClass} w-full`} value={loteDescricao} onChange={(e) => setLoteDescricao(e.target.value)} placeholder="Descrição do lote" />
                {step === 2 ? (
                  <button type="button" className={processosBtnPrimary} disabled={disparando} onClick={() => void disparar()}>
                    <Rocket className="h-4 w-4 inline mr-2" />
                    Disparar cobranças
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3">
              {disparando ? (
                <p className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Disparando cobranças…
                </p>
              ) : resultado ? (
                <>
                  <p className="text-sm">
                    ✅ Enviados: <strong>{resultado.enviados}</strong> · ❌ Falhos: <strong>{resultado.falhos}</strong>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {resultado.falhos > 0 ? (
                      <button type="button" className={processosBtnSecondary} onClick={() => void handleReenviar(resultado.loteId)}>
                        <RefreshCw className="h-4 w-4 inline mr-1" /> Reenviar falhos
                      </button>
                    ) : null}
                    <button type="button" className={processosBtnPrimary} onClick={() => { setTab('historico'); setStep(1); }}>
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
                  </p>
                </div>
                <div className="flex gap-2">
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
                          <th className="p-1">Telefone</th>
                          <th className="p-1">Valor</th>
                          <th className="p-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalhesLote.map((d) => (
                          <tr key={d.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="p-1">{d.pessoaNome}</td>
                            <td className="p-1">{d.unidadeDescricao}</td>
                            <td className="p-1">{d.phoneNumber}</td>
                            <td className="p-1">{Number(d.valorPendente ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
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
