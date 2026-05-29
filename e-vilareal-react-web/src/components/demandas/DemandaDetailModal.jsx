import { useEffect, useState } from 'react';
import { Link2, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { formatBRL } from '../../data/relatorioCalculosData.js';
import { listarPagamentos } from '../../repositories/pagamentosRepository.js';
import {
  alterarStatusDemanda,
  criarPagamentoAutomaticoDemanda,
  desvincularPagamentoDemanda,
  excluirDemanda,
  fetchDemanda,
  vincularPagamentoDemanda,
} from '../../repositories/demandasRepository.js';
import { imoveisBtnPrimary, imoveisBtnSecondary, imoveisInputClass } from '../imoveis/ImoveisAdminLayout.jsx';
import {
  DEMANDA_STATUS_OPTS,
  badgeStatus,
  demandaVencida,
  labelCategoria,
  labelStatus,
} from './demandasConstants.js';

function fmtData(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

export function DemandaDetailModal({ demandaId, open, onClose, onEdit, onRefresh }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [criarPagOpen, setCriarPagOpen] = useState(false);
  const [vincularOpen, setVincularOpen] = useState(false);
  const [pagamentosImovel, setPagamentosImovel] = useState([]);
  const [pagForm, setPagForm] = useState({ dataVencimento: '', codigoBarras: '', observacao: '' });
  const [histOpen, setHistOpen] = useState(true);

  useEffect(() => {
    if (!open || !demandaId) return;
    setLoading(true);
    setErro('');
    fetchDemanda(demandaId)
      .then(setD)
      .catch((e) => setErro(e?.message ?? 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [open, demandaId]);

  if (!open) return null;

  async function reload() {
    const fresh = await fetchDemanda(demandaId);
    setD(fresh);
    onRefresh?.();
  }

  async function mudarStatus(status) {
    await alterarStatusDemanda(demandaId, status);
    await reload();
  }

  async function handleCriarPagamento(e) {
    e.preventDefault();
    await criarPagamentoAutomaticoDemanda(demandaId, {
      dataVencimento: pagForm.dataVencimento || d.prazoFinalizacao?.slice?.(0, 10) || null,
      codigoBarras: pagForm.codigoBarras || null,
      observacao: pagForm.observacao || null,
      valorOriginal: d.valorEstimado,
    });
    setCriarPagOpen(false);
    await reload();
  }

  async function abrirVincular() {
    const list = await listarPagamentos({ imovelId: d.imovelId });
    setPagamentosImovel(Array.isArray(list) ? list.filter((p) => !p.financeiroLancamentoId) : []);
    setVincularOpen(true);
  }

  const reembolsado = d?.pagamentoStatus === 'ACERTADO';
  const conciliado = Boolean(d?.financeiroLancamentoId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-[#141c2c] rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-white/10">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 gap-3">
          <div className="min-w-0">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
            ) : d ? (
              <>
                <p className="text-sm text-slate-500 truncate">
                  {d.imovelTitulo} — {d.clienteNome}
                </p>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{d.descricao}</h2>
                <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${badgeStatus(d.status)}`}>
                  {labelStatus(d.status)}
                </span>
                {demandaVencida(d) ? (
                  <span className="ml-2 text-xs font-bold text-red-600">VENCIDO</span>
                ) : null}
              </>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {erro ? <p className="px-5 py-2 text-sm text-red-600">{erro}</p> : null}

        {d && !loading ? (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div><span className="text-slate-500 block">Categoria</span>{labelCategoria(d.categoria)}</div>
              <div><span className="text-slate-500 block">Fornecedor</span>{d.fornecedorTexto || '—'}</div>
              <div><span className="text-slate-500 block">Criado em</span>{fmtData(d.createdAt)}</div>
              <div><span className="text-slate-500 block">Prazo cumprimento</span>{fmtData(d.prazoCumprimento)}</div>
              <div><span className={demandaVencida(d) ? 'text-red-600 font-medium block' : 'text-slate-500 block'}>Prazo finalização</span>{fmtData(d.prazoFinalizacao)}</div>
              <div><span className="text-slate-500 block">Valor</span>{d.geraValorContabil ? formatBRL(Number(d.valorEstimado ?? 0)) : '—'}</div>
            </div>

            <section className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 p-4 text-sm space-y-1">
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-200">Situação financeira</h3>
              <p>Gera valor: {d.geraValorContabil ? 'Sim' : 'Não'}</p>
              <p>Pago pelo escritório: {d.pagoPeloEscritorio ? 'Sim' : 'Não'}</p>
              <p>Reembolsável: {d.reembolsavelCliente ? 'Sim' : 'Não'}</p>
              {d.reembolsavelCliente && d.geraValorContabil ? (
                <p className="font-medium">
                  Reembolso: {formatBRL(Number(d.valorEstimado ?? 0))}{' '}
                  <span className={reembolsado ? 'text-emerald-700' : 'text-amber-700'}>
                    ({reembolsado ? 'Conciliado / acertado' : 'Pendente'})
                  </span>
                </p>
              ) : null}
            </section>

            <section className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 p-4 text-sm">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">Pagamento vinculado</h3>
              {d.pagamentoId ? (
                <div className="space-y-1">
                  <p>ID #{d.pagamentoId} — {d.pagamentoStatus} — {formatBRL(Number(d.pagamentoValor ?? 0))}</p>
                  <button type="button" className={imoveisBtnSecondary} onClick={() => desvincularPagamentoDemanda(demandaId).then(reload)}>
                    Desvincular
                  </button>
                </div>
              ) : d.geraValorContabil ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={imoveisBtnPrimary} onClick={() => setCriarPagOpen(true)}>
                    Criar pagamento automaticamente
                  </button>
                  <button type="button" className={imoveisBtnSecondary} onClick={abrirVincular}>
                    <Link2 className="w-4 h-4" /> Vincular existente
                  </button>
                </div>
              ) : (
                <p className="text-slate-600">Demanda sem valor contábil.</p>
              )}
            </section>

            <section className="rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 text-sm">
              <h3 className="font-semibold mb-2">Extrato vinculado</h3>
              {conciliado ? (
                <p>
                  Lançamento financeiro #{d.financeiroLancamentoId}{' '}
                  <span className="text-emerald-700 font-medium">Conciliado</span>
                </p>
              ) : d.pagamentoId ? (
                <p className="text-slate-600">Aguardando conciliação — use a tela Conciliação Bancária.</p>
              ) : (
                <p className="text-slate-500">Sem pagamento vinculado.</p>
              )}
            </section>

            {d.observacoes ? (
              <section className="text-sm">
                <h3 className="font-semibold mb-1">Observações</h3>
                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{d.observacoes}</p>
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {DEMANDA_STATUS_OPTS.filter((s) => s.value !== d.status).map((s) => (
                <button key={s.value} type="button" className={imoveisBtnSecondary} onClick={() => mudarStatus(s.value)}>
                  → {s.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
              <button type="button" className={imoveisBtnSecondary} onClick={() => onEdit(d)}>
                <Pencil className="w-4 h-4" /> Editar
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-700 border border-red-200 rounded-xl hover:bg-red-50"
                onClick={async () => {
                  if (!window.confirm('Cancelar esta demanda?')) return;
                  await excluirDemanda(demandaId);
                  onRefresh?.();
                  onClose();
                }}
              >
                <Trash2 className="w-4 h-4" /> Excluir
              </button>
            </div>

            <section>
              <button type="button" className="text-sm font-semibold text-teal-700" onClick={() => setHistOpen((v) => !v)}>
                Histórico {histOpen ? '▲' : '▼'}
              </button>
              {histOpen && Array.isArray(d.historico) ? (
                <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  {d.historico.map((h) => (
                    <li key={h.id} className="border-l-2 border-teal-400 pl-2">
                      <span className="text-slate-500">{fmtData(h.createdAt)}</span>
                      {' — '}
                      {h.statusAnterior ? `${h.statusAnterior} → ` : ''}
                      <strong>{h.statusNovo}</strong>
                      {h.descricaoAcao ? `: ${h.descricaoAcao}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>

      {criarPagOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
          <form onSubmit={handleCriarPagamento} className="bg-white dark:bg-[#141c2c] rounded-xl p-5 w-full max-w-md space-y-3 border shadow-lg">
            <h3 className="font-semibold">Criar pagamento</h3>
            <label className="block text-sm">
              Vencimento
              <input type="date" className={`${imoveisInputClass} mt-1`} value={pagForm.dataVencimento} onChange={(ev) => setPagForm((f) => ({ ...f, dataVencimento: ev.target.value }))} />
            </label>
            <label className="block text-sm">
              Código de barras
              <input className={`${imoveisInputClass} mt-1`} value={pagForm.codigoBarras} onChange={(ev) => setPagForm((f) => ({ ...f, codigoBarras: ev.target.value }))} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className={imoveisBtnSecondary} onClick={() => setCriarPagOpen(false)}>Cancelar</button>
              <button type="submit" className={imoveisBtnPrimary}>Criar</button>
            </div>
          </form>
        </div>
      ) : null}

      {vincularOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white dark:bg-[#141c2c] rounded-xl p-5 w-full max-w-md max-h-[70vh] overflow-y-auto border shadow-lg">
            <h3 className="font-semibold mb-3">Vincular pagamento</h3>
            {pagamentosImovel.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum pagamento disponível para este imóvel.</p>
            ) : (
              <ul className="space-y-2">
                {pagamentosImovel.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full text-left text-sm px-3 py-2 rounded-lg border hover:bg-slate-50 dark:hover:bg-white/5"
                      onClick={async () => {
                        await vincularPagamentoDemanda(demandaId, p.id);
                        setVincularOpen(false);
                        await reload();
                      }}
                    >
                      #{p.id} — {p.descricao?.slice(0, 40)} — {formatBRL(Number(p.valor ?? 0))}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className={`${imoveisBtnSecondary} mt-3`} onClick={() => setVincularOpen(false)}>Fechar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
