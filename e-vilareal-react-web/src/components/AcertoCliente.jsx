import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCheck, Loader2, Search, X } from 'lucide-react';
import { formatBRL } from '../data/relatorioCalculosData.js';
import { listarClientesIndiceCadastro } from '../repositories/clientesRepository.js';
import {
  aprovarPrestacaoContas,
  atualizarPrestacaoContas,
  baixarPdfPrestacaoContas,
  buscarPagamentosPendentesPrestacao,
  buscarPrestacaoContas,
  criarPrestacaoContas,
  enviarPrestacaoContas,
  excluirPrestacaoContas,
  listarPrestacaoContas,
} from '../repositories/prestacaoContasRepository.js';
import { badgeCategoriaClass, badgePrestacaoStatus } from './pagamentos/pagamentosUiUtils.js';

function primeiroDiaMesIso(ref = new Date()) {
  const y = ref.getFullYear();
  const mo = String(ref.getMonth() + 1).padStart(2, '0');
  return `${y}-${mo}-01`;
}

function ultimoDiaMesIso(ref = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const mo = String(m + 1).padStart(2, '0');
  return `${y}-${mo}-${String(last).padStart(2, '0')}`;
}

function fmtData(iso) {
  if (iso == null || iso === '') return '—';
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtDataHora(iso) {
  if (iso == null || iso === '') return '—';
  const s = String(iso);
  const d = s.slice(0, 10);
  const t = s.length > 11 ? s.slice(11, 16) : '';
  return `${fmtData(d)}${t ? ` ${t}` : ''}`;
}

function rotuloImovelGrupo(g) {
  if (!g?.imovel?.id) return 'Sem imóvel vinculado';
  const np = g.imovel.numeroPlanilha || '';
  const end = g.imovel.endereco || '';
  return `Imóvel: ${np}${end ? ` — ${end}` : ''}`;
}

function valorPagamento(p) {
  return Number(p?.valorPagoBanco ?? p?.valor ?? 0);
}

export function AcertoCliente() {
  const [aba, setAba] = useState('nova');
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState(primeiroDiaMesIso);
  const [periodoFim, setPeriodoFim] = useState(ultimoDiaMesIso);
  const [grupos, setGrupos] = useState([]);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagemOk, setMensagemOk] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [taxaPct, setTaxaPct] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarClientesIndiceCadastro()
      .then((lista) => setClientes((lista || []).filter((c) => c.clienteId != null)))
      .catch(() => setClientes([]));
  }, []);

  useEffect(() => {
    if (!mensagemOk) return undefined;
    const t = setTimeout(() => setMensagemOk(''), 5000);
    return () => clearTimeout(t);
  }, [mensagemOk]);

  const clienteSel = useMemo(
    () => clientes.find((c) => String(c.clienteId ?? c.id) === String(clienteId)),
    [clientes, clienteId],
  );

  const resumoSelecao = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const g of grupos) {
      for (const p of g.pagamentos || []) {
        if (selecionados.has(p.id)) {
          count++;
          total += valorPagamento(p);
        }
      }
    }
    return { count, total };
  }, [grupos, selecionados]);

  const taxaPreview = useMemo(() => {
    const pct = Number(String(taxaPct).replace(',', '.'));
    const total = resumoSelecao.total;
    if (!Number.isFinite(pct) || pct <= 0) {
      return { taxa: 0, liquido: total, temTaxa: false };
    }
    const taxa = (total * pct) / 100;
    return { taxa, liquido: total - taxa, temTaxa: true, pct };
  }, [taxaPct, resumoSelecao.total]);

  const carregarHistorico = useCallback(async () => {
    const q = { page: 0, size: 50, sort: 'criadoEm,desc' };
    if (clienteId) q.clienteId = Number(clienteId);
    const page = await listarPrestacaoContas(q);
    setHistorico(Array.isArray(page?.content) ? page.content : Array.isArray(page) ? page : []);
  }, [clienteId]);

  useEffect(() => {
    if (aba === 'historico') void carregarHistorico();
  }, [aba, carregarHistorico]);

  async function buscarPendentes() {
    if (!clienteId) {
      setErro('Selecione um cliente.');
      return;
    }
    setCarregando(true);
    setErro('');
    setSelecionados(new Set());
    try {
      const data = await buscarPagamentosPendentesPrestacao({
        clienteId: Number(clienteId),
        periodoInicio,
        periodoFim,
      });
      setGrupos(Array.isArray(data) ? data : []);
    } catch (e) {
      setErro(e?.message || 'Falha ao buscar pagamentos.');
      setGrupos([]);
    } finally {
      setCarregando(false);
    }
  }

  function togglePagamento(id) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleGrupo(g) {
    const ids = (g.pagamentos || []).map((p) => p.id);
    const todos = ids.every((id) => selecionados.has(id));
    setSelecionados((prev) => {
      const n = new Set(prev);
      for (const id of ids) {
        if (todos) n.delete(id);
        else n.add(id);
      }
      return n;
    });
  }

  function abrirModalGerar() {
    if (resumoSelecao.count === 0) return;
    setTaxaPct('');
    setObservacoes('');
    setModalAberto(true);
  }

  async function abrirEdicao(id) {
    setCarregando(true);
    setErro('');
    try {
      const det = await buscarPrestacaoContas(id);
      setEditandoId(id);
      setClienteId(String(det.cliente?.id ?? ''));
      setPeriodoInicio(String(det.periodoInicio || '').slice(0, 10));
      setPeriodoFim(String(det.periodoFim || '').slice(0, 10));
      const data = await buscarPagamentosPendentesPrestacao({
        clienteId: det.cliente.id,
        periodoInicio: det.periodoInicio,
        periodoFim: det.periodoFim,
      });
      const gruposApi = Array.isArray(data) ? data : [];
      const idsPrestacao = new Set((det.pagamentos || []).map((p) => p.id));
      const gruposMerged = [...gruposApi];
      for (const p of det.pagamentos || []) {
        if (!gruposMerged.some((g) => (g.pagamentos || []).some((x) => x.id === p.id))) {
          let gSem = gruposMerged.find((g) => !g.imovel?.id);
          if (!gSem) {
            gSem = { imovel: {}, pagamentos: [], subtotal: 0, quantidadePagamentos: 0 };
            gruposMerged.push(gSem);
          }
          gSem.pagamentos.push(p);
        }
      }
      setGrupos(gruposMerged);
      setSelecionados(idsPrestacao);
      setTaxaPct(
        det.taxaAdministracaoPercentual != null ? String(det.taxaAdministracaoPercentual) : '',
      );
      setObservacoes(det.observacoes || '');
      setAba('nova');
      setModalAberto(false);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar prestação.');
    } finally {
      setCarregando(false);
    }
  }

  function montarBody() {
    const pct = String(taxaPct).trim();
    return {
      clienteId: Number(clienteId),
      periodoInicio,
      periodoFim,
      pagamentoIds: [...selecionados],
      taxaAdministracaoPercentual:
        pct !== '' && Number.isFinite(Number(pct.replace(',', '.')))
          ? Number(pct.replace(',', '.'))
          : null,
      observacoes: observacoes.trim() || null,
    };
  }

  async function salvarRascunho() {
    setSalvando(true);
    setErro('');
    try {
      const body = montarBody();
      if (editandoId) {
        await atualizarPrestacaoContas(editandoId, {
          periodoInicio: body.periodoInicio,
          periodoFim: body.periodoFim,
          pagamentoIds: body.pagamentoIds,
          taxaAdministracaoPercentual: body.taxaAdministracaoPercentual,
          observacoes: body.observacoes,
        });
        setMensagemOk('Prestação atualizada como rascunho.');
      } else {
        await criarPrestacaoContas(body);
        setMensagemOk('Prestação de contas criada como rascunho.');
      }
      setModalAberto(false);
      setEditandoId(null);
      setSelecionados(new Set());
      setGrupos([]);
      setAba('historico');
      await carregarHistorico();
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar prestação.');
    } finally {
      setSalvando(false);
    }
  }

  async function enviarAoCliente() {
    setSalvando(true);
    setErro('');
    try {
      const body = montarBody();
      let id = editandoId;
      if (id) {
        await atualizarPrestacaoContas(id, {
          periodoInicio: body.periodoInicio,
          periodoFim: body.periodoFim,
          pagamentoIds: body.pagamentoIds,
          taxaAdministracaoPercentual: body.taxaAdministracaoPercentual,
          observacoes: body.observacoes,
        });
      } else {
        const criada = await criarPrestacaoContas(body);
        id = criada.id;
      }
      const enviada = await enviarPrestacaoContas(id);
      const qtd = enviada.pagamentos?.length ?? body.pagamentoIds.length;
      setMensagemOk(`Prestação enviada — ${qtd} pagamento(s) marcados como acertados.`);
      setModalAberto(false);
      setEditandoId(null);
      try {
        const blob = await baixarPdfPrestacaoContas(id);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch {
        setErro('Prestação enviada, mas o PDF não pôde ser aberto.');
      }
      setAba('historico');
      await carregarHistorico();
    } catch (e) {
      setErro(e?.message || 'Falha ao enviar prestação.');
    } finally {
      setSalvando(false);
    }
  }

  async function acaoEnviarHistorico(row) {
    if (!window.confirm('Enviar prestação ao cliente? Os pagamentos serão marcados como acertados.')) {
      return;
    }
    setErro('');
    try {
      await enviarPrestacaoContas(row.id);
      setMensagemOk('Prestação enviada.');
      const blob = await baixarPdfPrestacaoContas(row.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      await carregarHistorico();
    } catch (e) {
      setErro(e?.message || 'Falha ao enviar.');
    }
  }

  async function acaoExcluir(row) {
    if (
      !window.confirm('Excluir prestação? Os pagamentos voltarão para Conferido.')
    ) {
      return;
    }
    setErro('');
    try {
      await excluirPrestacaoContas(row.id);
      setMensagemOk('Prestação excluída.');
      await carregarHistorico();
    } catch (e) {
      setErro(e?.message || 'Falha ao excluir.');
    }
  }

  async function acaoAprovar(row) {
    if (!window.confirm('Confirmar aprovação do cliente?')) return;
    setErro('');
    try {
      await aprovarPrestacaoContas(row.id);
      setMensagemOk('Prestação aprovada.');
      await carregarHistorico();
    } catch (e) {
      setErro(e?.message || 'Falha ao aprovar.');
    }
  }

  async function acaoDownloadPdf(row) {
    try {
      const blob = await baixarPdfPrestacaoContas(row.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prestacao_contas_${row.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e?.message || 'PDF não disponível.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 via-violet-50/35 to-indigo-50/45 dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] p-4 md:p-6">
      <header className="flex items-center gap-3 mb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg">
          <FileCheck className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Acerto com Cliente</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Prestação de contas formal para proprietários — pagamentos conferidos.
          </p>
        </div>
      </header>

      {erro ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {erro}
        </div>
      ) : null}
      {mensagemOk ? (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
          {mensagemOk}
        </div>
      ) : null}

      <div className="flex gap-2 mb-4 border-b border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setAba('nova')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            aba === 'nova'
              ? 'border-violet-600 text-violet-800 dark:text-violet-300'
              : 'border-transparent text-slate-500'
          }`}
        >
          Nova prestação
        </button>
        <button
          type="button"
          onClick={() => setAba('historico')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            aba === 'historico'
              ? 'border-violet-600 text-violet-800 dark:text-violet-300'
              : 'border-transparent text-slate-500'
          }`}
        >
          Histórico
        </button>
      </div>

      {aba === 'nova' ? (
        <>
          <section className="rounded-xl border border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/85 p-4 mb-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <label className="flex flex-col gap-0.5 sm:col-span-2">
                <span className="text-slate-500">Cliente *</span>
                <select
                  className="rounded border border-slate-300 px-2 py-1.5 dark:bg-slate-950 dark:border-slate-600"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {clientes.map((c) => (
                    <option key={c.clienteId ?? c.id} value={String(c.clienteId ?? c.id)}>
                      {c.codigo} — {c.nomeRazao}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-slate-500">Período início</span>
                <input
                  type="date"
                  className="rounded border border-slate-300 px-2 py-1.5 dark:bg-slate-950"
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-slate-500">Período fim</span>
                <input
                  type="date"
                  className="rounded border border-slate-300 px-2 py-1.5 dark:bg-slate-950"
                  value={periodoFim}
                  onChange={(e) => setPeriodoFim(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={carregando}
              onClick={() => void buscarPendentes()}
              className="mt-3 inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar pagamentos pendentes
            </button>
            {editandoId ? (
              <span className="ml-3 text-xs text-violet-700 dark:text-violet-300">
                Editando rascunho #{editandoId}
              </span>
            ) : null}
          </section>

          {grupos.length === 0 && !carregando ? (
            <p className="text-sm text-slate-500 text-center py-8">
              {clienteId
                ? 'Nenhum pagamento conferido pendente de acerto para este cliente no período.'
                : 'Selecione um cliente e busque pagamentos pendentes.'}
            </p>
          ) : null}

          {grupos.map((g, gi) => {
            const idsGrupo = (g.pagamentos || []).map((p) => p.id);
            const todosSel = idsGrupo.length > 0 && idsGrupo.every((id) => selecionados.has(id));
            let subSel = 0;
            for (const p of g.pagamentos || []) {
              if (selecionados.has(p.id)) subSel += valorPagamento(p);
            }
            return (
              <section
                key={gi}
                className="rounded-xl border border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/85 mb-3 overflow-hidden"
              >
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{rotuloImovelGrupo(g)}</h2>
                  <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={todosSel}
                      onChange={() => toggleGrupo(g)}
                    />
                    Selecionar todos
                  </label>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-left">
                      <tr>
                        <th className="px-2 py-1.5 w-8" />
                        <th className="px-2 py-1.5">Data</th>
                        <th className="px-2 py-1.5">Categoria</th>
                        <th className="px-2 py-1.5">Descrição</th>
                        <th className="px-2 py-1.5">Mês Ref</th>
                        <th className="px-2 py-1.5 text-right">Boleto</th>
                        <th className="px-2 py-1.5 text-right">Pago</th>
                        <th className="px-2 py-1.5 text-right">Dif.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(g.pagamentos || []).map((p) => (
                        <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-2 py-1">
                            <input
                              type="checkbox"
                              checked={selecionados.has(p.id)}
                              onChange={() => togglePagamento(p.id)}
                            />
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap">
                            {fmtData(p.dataPagamentoEfetivo || p.dataVencimento)}
                          </td>
                          <td className="px-2 py-1">
                            <span className={badgeCategoriaClass(p.categoria)}>{p.categoria}</span>
                          </td>
                          <td className="px-2 py-1 max-w-[200px] truncate" title={p.descricao}>
                            {p.descricao}
                          </td>
                          <td className="px-2 py-1">{p.mesReferencia || '—'}</td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {formatBRL(Number(p.valor ?? 0))}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums font-medium">
                            {formatBRL(valorPagamento(p))}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {formatBRL(Number(p.valorDiferenca ?? 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2 text-xs text-right border-t border-slate-200 dark:border-slate-700">
                  Subtotal selecionado: <strong>{formatBRL(subSel)}</strong>
                </div>
              </section>
            );
          })}

          {grupos.length > 0 ? (
            <div className="sticky bottom-4 rounded-xl border border-violet-200 bg-violet-50/95 dark:bg-violet-950/40 dark:border-violet-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <span className="text-sm font-medium">
                Pagamentos selecionados: {resumoSelecao.count} — Total:{' '}
                <strong>{formatBRL(resumoSelecao.total)}</strong>
              </span>
              <button
                type="button"
                disabled={resumoSelecao.count === 0}
                onClick={abrirModalGerar}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Gerar prestação de contas
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <section className="rounded-xl border border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/85 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-left">
                <tr>
                  <th className="px-2 py-2">Data</th>
                  <th className="px-2 py-2">Cliente</th>
                  <th className="px-2 py-2">Período</th>
                  <th className="px-2 py-2 text-right">Qtd</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2 text-right">Taxa</th>
                  <th className="px-2 py-2 text-right">Líquido</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtDataHora(row.criadoEm)}</td>
                    <td className="px-2 py-1.5">
                      {row.cliente?.codigoCliente} — {row.cliente?.nome}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {fmtData(row.periodoInicio)} — {fmtData(row.periodoFim)}
                    </td>
                    <td className="px-2 py-1.5 text-right">{row.quantidadePagamentos}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatBRL(Number(row.valorTotalPagamentos ?? 0))}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {row.taxaAdministracaoValor != null
                        ? formatBRL(Number(row.taxaAdministracaoValor))
                        : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                      {formatBRL(Number(row.valorLiquido ?? 0))}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={badgePrestacaoStatus(row.status)}>{row.status}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {row.status === 'RASCUNHO' ? (
                          <>
                            <button
                              type="button"
                              className="rounded border px-1.5 py-0.5 hover:bg-slate-50"
                              onClick={() => void abrirEdicao(row.id)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="rounded border border-sky-300 px-1.5 py-0.5 hover:bg-sky-50"
                              onClick={() => void acaoEnviarHistorico(row)}
                            >
                              Enviar
                            </button>
                            <button
                              type="button"
                              className="rounded border border-red-300 px-1.5 py-0.5 hover:bg-red-50"
                              onClick={() => void acaoExcluir(row)}
                            >
                              Excluir
                            </button>
                          </>
                        ) : null}
                        {row.status === 'ENVIADO' ? (
                          <>
                            <button
                              type="button"
                              className="rounded border px-1.5 py-0.5"
                              onClick={() => void acaoDownloadPdf(row)}
                            >
                              PDF
                            </button>
                            <button
                              type="button"
                              className="rounded border border-emerald-300 px-1.5 py-0.5"
                              onClick={() => void acaoAprovar(row)}
                            >
                              Aprovar
                            </button>
                          </>
                        ) : null}
                        {row.status === 'APROVADO' ? (
                          <button
                            type="button"
                            className="rounded border px-1.5 py-0.5"
                            onClick={() => void acaoDownloadPdf(row)}
                          >
                            PDF
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {historico.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      Nenhuma prestação encontrada.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modalAberto ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-base font-bold">Gerar prestação de contas</h2>
              <button type="button" onClick={() => setModalAberto(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950/50 p-2 space-y-1">
                <div>
                  <span className="text-slate-500">Cliente:</span>{' '}
                  {clienteSel?.codigo} — {clienteSel?.nomeRazao}
                </div>
                <div>
                  <span className="text-slate-500">Período:</span> {fmtData(periodoInicio)} a{' '}
                  {fmtData(periodoFim)}
                </div>
                <div>
                  <span className="text-slate-500">Pagamentos:</span> {resumoSelecao.count} —{' '}
                  {formatBRL(resumoSelecao.total)}
                </div>
              </div>
              <label className="flex flex-col gap-0.5">
                <span className="font-medium">Taxa de administração (%)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="Ex: 10"
                  className="rounded border border-slate-300 px-2 py-1.5 dark:bg-slate-950"
                  value={taxaPct}
                  onChange={(e) => setTaxaPct(e.target.value)}
                />
                {taxaPreview.temTaxa ? (
                  <span className="text-violet-700 dark:text-violet-300">
                    Taxa: {formatBRL(taxaPreview.taxa)} — Líquido: {formatBRL(taxaPreview.liquido)}
                  </span>
                ) : (
                  <span className="text-slate-500">Sem taxa de administração</span>
                )}
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="font-medium">Observações</span>
                <textarea
                  rows={3}
                  className="rounded border border-slate-300 px-2 py-1.5 dark:bg-slate-950"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3">
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => setModalAberto(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                className="rounded-lg border border-violet-400 px-3 py-1.5 text-sm font-semibold text-violet-800 dark:text-violet-200"
                onClick={() => void salvarRascunho()}
              >
                Salvar rascunho
              </button>
              <button
                type="button"
                disabled={salvando}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 inline-flex items-center gap-1"
                onClick={() => void enviarAoCliente()}
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Enviar ao cliente
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
