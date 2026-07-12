import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { useCloseOnEscape } from '../../../../hooks/useCloseOnEscape.js';
import {
  baixarPdfAcertoFechamentoApi,
  listarCompensacaoPorRowIdsApi,
  listarLancamentosPorGrupoCompensacaoApi,
} from '../../../../repositories/financeiroRepository.js';
import { formatMoeda } from '../../shared/financeiroFormat.js';
import { useFinanceiroToast } from '../../shared/Toast.jsx';
import { AcertoConsultaRapidaButtons } from './AcertoConsultaRapidaButtons.jsx';
import {
  fmtDataAcerto,
  isCardAcerto,
  refExibicaoAcerto,
  legendaSaldoAcerto,
  valorAssinadoAcerto,
} from './acertoUtils.js';

function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function rowIdFromDetalheAcerto(det) {
  const m = String(det ?? '').match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Modal flutuante para consulta de um card de acerto (grupo compensado, soma zero).
 * Não altera filtros nem seleção da tela principal ao fechar.
 */
export function AcertoCardModal({
  card,
  numeroBanco,
  clienteId,
  codigoCliente,
  refreshKey = 0,
  onClose,
  onAbrirLancamento,
  onAbrirConsultaProcesso,
  onAbrirConsultaContaCorrente,
}) {
  const toast = useFinanceiroToast();
  const [rows, setRows] = useState(null);
  const [elosComp, setElosComp] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useCloseOnEscape(!!card, onClose, { lockScroll: true });

  const grupo = card?.grupoCompensacao ? String(card.grupoCompensacao).trim() : '';

  useEffect(() => {
    if (!grupo || numeroBanco == null) {
      setRows(null);
      setElosComp(null);
      return undefined;
    }
    const ac = new AbortController();
    setCarregando(true);
    setErro('');
    listarLancamentosPorGrupoCompensacaoApi(grupo, { signal: ac.signal })
      .then((lista) => {
        const filtrados = (Array.isArray(lista) ? lista : []).filter(
          (l) => Number(l.numeroBanco) === Number(numeroBanco),
        );
        filtrados.sort((a, b) => {
          const da = String(a.dataLancamento ?? '');
          const db = String(b.dataLancamento ?? '');
          if (da !== db) return da.localeCompare(db);
          return Number(a.id) - Number(b.id);
        });
        setRows(filtrados);
        const rowIds = [...new Set(filtrados.map((l) => rowIdFromDetalheAcerto(l.descricaoDetalhada)).filter(Boolean))];
        if (rowIds.length === 0) {
          setElosComp([]);
          return;
        }
        return listarCompensacaoPorRowIdsApi(rowIds, { signal: ac.signal }).then((elos) => {
          setElosComp(Array.isArray(elos) ? elos : []);
        });
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') {
          setErro(e?.message || 'Falha ao carregar lançamentos do card.');
          setRows([]);
          setElosComp([]);
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setCarregando(false);
      });
    return () => ac.abort();
  }, [grupo, numeroBanco, refreshKey]);

  const elosForaCard = useMemo(() => {
    if (!elosComp?.length) return [];
    const cardIds = new Set((rows ?? []).map((l) => l.id));
    return elosComp.map((e) => ({
      elo: e.elo,
      lancamentos: (e.lancamentos ?? []).filter((l) => !cardIds.has(l.id)),
    })).filter((e) => e.lancamentos.length > 0);
  }, [elosComp, rows]);

  const totais = useMemo(() => {
    if (!rows) return null;
    let cred = 0;
    let deb = 0;
    let saldo = 0;
    for (const l of rows) {
      const v = valorAssinadoAcerto(l);
      saldo += v;
      if (v >= 0) cred += v;
      else deb += Math.abs(v);
    }
    return { cred, deb, saldo, qtd: rows.length };
  }, [rows]);

  const baixarPdf = async () => {
    if (!card?.fechamentoId) return;
    try {
      const blob = await baixarPdfAcertoFechamentoApi(card.fechamentoId);
      baixarBlob(blob, `acerto_card_${grupo || card.fechamentoId}.pdf`);
    } catch (e) {
      toast.error(e?.message || 'Falha ao baixar o PDF.');
    }
  };

  if (!card || !isCardAcerto(card)) return null;

  const titulo =
    card.titulo?.trim() ||
    (card.dataFim ? `Card até ${fmtDataAcerto(card.dataFim)}` : grupo || 'Card de acerto');

  return (
    <div
      className="fixed inset-0 z-[68] flex items-center justify-center p-2 sm:p-4 bg-black/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="acerto-card-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex flex-col w-[min(100vw-0.5rem,960px)] max-h-[min(100dvh-0.5rem,880px)] min-h-0 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-indigo-50/60 dark:bg-indigo-950/30 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
              Card de acerto · soma zero
            </p>
            <h2 id="acerto-card-modal-title" className="text-base font-semibold text-slate-900 dark:text-white truncate">
              {titulo}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-600 dark:text-slate-300">
              {grupo ? (
                <span className="font-mono px-1.5 py-0.5 rounded border border-indigo-300 text-indigo-800 dark:text-indigo-200 bg-white/80 dark:bg-slate-900/80">
                  {grupo}
                </span>
              ) : null}
              {card.numeroInternoProcesso != null ? (
                <span className="font-mono px-1.5 py-0.5 rounded border border-slate-300">
                  proc {card.numeroInternoProcesso}
                </span>
              ) : null}
              {card.dataFim ? <span>{fmtDataAcerto(card.dataFim)}</span> : null}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {card.fechamentoId && card.temPdf ? (
              <button
                type="button"
                onClick={() => void baixarPdf()}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
            ) : null}
            {codigoCliente && card.numeroInternoProcesso != null ? (
              <AcertoConsultaRapidaButtons
                codigoCliente={codigoCliente}
                numeroInterno={card.numeroInternoProcesso}
                onAbrirProcesso={onAbrirConsultaProcesso}
                onAbrirContaCorrente={onAbrirConsultaContaCorrente}
              />
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
              aria-label="Fechar card"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {totais ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 text-xs border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
            <span>
              <strong>{totais.qtd.toLocaleString('pt-BR')}</strong> lanç.
            </span>
            <span className="text-emerald-700 dark:text-emerald-300">Créd. {formatMoeda(totais.cred)}</span>
            <span className="text-red-700 dark:text-red-300">Déb. {formatMoeda(totais.deb)}</span>
            <span className={Math.abs(totais.saldo) < 0.005 ? 'text-slate-600' : 'text-amber-700 dark:text-amber-300'}>
              Saldo {formatMoeda(totais.saldo)} · {legendaSaldoAcerto(totais.saldo)}
            </span>
          </div>
        ) : null}

        <div className="flex-1 min-h-0 overflow-auto">
          {carregando ? (
            <p className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando lançamentos…
            </p>
          ) : erro ? (
            <p className="px-4 py-8 text-sm text-red-600 dark:text-red-400">{erro}</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 z-[1]">
                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Proc</th>
                  <th className="px-3 py-2 font-medium">Descrição</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((l) => {
                  const v = valorAssinadoAcerto(l);
                  return (
                    <tr
                      key={l.id}
                      className={`border-t border-slate-100 dark:border-slate-800 ${
                        onAbrirLancamento ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''
                      }`}
                      onClick={() => onAbrirLancamento?.(l)}
                    >
                      <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{fmtDataAcerto(l.dataLancamento)}</td>
                      <td className="px-3 py-1.5 font-mono whitespace-nowrap">{refExibicaoAcerto(l)}</td>
                      <td className="px-3 py-1.5 max-w-[360px]">
                        <span className="block truncate" title={l.descricao}>
                          {l.descricao}
                        </span>
                        {String(l.descricaoDetalhada ?? '').trim() ? (
                          <span className="block truncate text-[10px] text-slate-400" title={l.descricaoDetalhada}>
                            {l.descricaoDetalhada}
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={`px-3 py-1.5 text-right tabular-nums font-medium whitespace-nowrap ${
                          v < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {formatMoeda(v)}
                      </td>
                    </tr>
                  );
                })}
                {!carregando && rows?.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      Nenhum lançamento neste grupo para o cliente.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>

        {elosForaCard.length > 0 ? (
          <div className="shrink-0 border-t border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 px-4 py-3 max-h-48 overflow-auto">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200 mb-2">
              Compensação bancária (elo)
            </p>
            {elosForaCard.map((e) => (
              <div key={e.elo} className="mb-2 last:mb-0">
                <p className="text-xs font-mono text-amber-900 dark:text-amber-100 mb-1">Elo {e.elo}</p>
                <ul className="space-y-0.5 text-xs">
                  {e.lancamentos.map((l) => {
                    const v = valorAssinadoAcerto(l);
                    return (
                      <li key={l.id} className="flex flex-wrap gap-x-2 justify-between text-slate-700 dark:text-slate-300">
                        <span className="truncate min-w-0 flex-1">
                          {l.bancoNome ?? `Banco ${l.numeroBanco}`} · {l.descricao}
                        </span>
                        <span className={`tabular-nums font-medium ${v < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                          {formatMoeda(v)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        <footer className="shrink-0 px-4 py-2 text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          Somente consulta — o card não altera a fila de trabalho do período aberto. Feche para voltar à tela.
        </footer>
      </div>
    </div>
  );
}
