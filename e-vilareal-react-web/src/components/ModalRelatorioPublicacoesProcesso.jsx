import { useState, useEffect, useCallback } from 'react';
import { X, Newspaper, Loader2 } from 'lucide-react';
import {
  alterarStatusPublicacao,
  listarPublicacoesRelatorioPorProcesso,
} from '../repositories/publicacoesRepository.js';
import { featureFlags } from '../config/featureFlags.js';
import { formatarRotuloVinculoPartes } from '../data/publicacoesDisplayHelpers.js';
import { useCloseOnEscape } from '../hooks/useCloseOnEscape.js';

const STATUS_LABEL = {
  PENDENTE: 'Pendente',
  VINCULADA: 'Vinculada',
  TRATADA: 'Tratada',
  IGNORADA: 'Ignorada',
};

function Badge({ children, tone = 'slate' }) {
  const cls = {
    slate: 'bg-slate-100 text-slate-800',
    green: 'bg-emerald-100 text-emerald-900',
    amber: 'bg-amber-100 text-amber-950',
    red: 'bg-red-100 text-red-900',
  }[tone];
  return <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${cls}`}>{children}</span>;
}

function rotuloStatusCnj(s) {
  const m = {
    processo_confirmado_cnj: 'Confirmado CNJ',
    processo_nao_confirmado_cnj: 'Não confirmado',
    divergencia_pdf_cnj: 'Divergência PDF×CNJ',
    consulta_indisponivel: 'Consulta indisponível',
    nao_consultado: 'Não consultado',
    tribunal_nao_mapeado: 'Tribunal não mapeado',
  };
  return m[s] || s || '—';
}

function ScoreBadge({ score }) {
  if (!score) return <Badge tone="slate">—</Badge>;
  const tone = score === 'alto' ? 'green' : score === 'medio' ? 'amber' : 'red';
  const lab = score === 'alto' ? 'Alto' : score === 'medio' ? 'Médio' : 'Baixo';
  return <Badge tone={tone}>{lab}</Badge>;
}

function rotuloFonte(meta) {
  if (!meta) return '';
  if (meta.fonte === 'legado') return 'armazenamento local';
  if (meta.fonte === 'api') return `API (processo #${meta.processoIdResolvido})`;
  if (meta.fonte === 'api_mesclado_legado') return `API + itens locais (processo #${meta.processoIdResolvido})`;
  if (meta.fonte === 'legado_fallback_sem_id') return 'armazenamento local (sem id de processo na API)';
  if (meta.fonte === 'legado_fallback_erro') return 'armazenamento local (fallback após erro na API)';
  return '';
}

export function statusTratamentoLinha(row) {
  if (row._statusTratamento) return row._statusTratamento;
  if (row.statusVinculo === 'ignorada') return 'IGNORADA';
  if (row.statusVinculo === 'vinculado') return 'VINCULADA';
  return 'PENDENTE';
}

function badgeStatusTratamentoClass(status) {
  switch (status) {
    case 'VINCULADA':
      return 'bg-sky-100 text-sky-800';
    case 'TRATADA':
      return 'bg-emerald-100 text-emerald-800';
    case 'IGNORADA':
      return 'bg-slate-200 text-slate-600';
    default:
      return 'bg-amber-100 text-amber-900';
  }
}

function aplicarStatusNaLinha(row, status) {
  const statusVinculo =
    status === 'VINCULADA' || status === 'TRATADA'
      ? 'vinculado'
      : status === 'IGNORADA'
        ? 'ignorada'
        : 'nao_vinculado';
  return { ...row, _statusTratamento: status, statusVinculo };
}

function notificarRelatorioAtualizado() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('vilareal:publicacoes-processo-relatorio-atualizado'));
}

/** Faixa de estado + tabela (reutilizado na aba Processos e no modal). */
export function PublicacoesRelatorioConteudo({
  itens,
  carregando,
  erro,
  relatorioMeta,
  /** Padding ligeiramente menor na aba embutida. */
  compact = false,
}) {
  const stripPad = compact ? 'px-3 py-2' : 'px-4 py-2';
  const bodyPad = compact ? 'p-2 md:p-3' : 'p-4';
  const [itensLocais, setItensLocais] = useState(itens);
  const [statusErro, setStatusErro] = useState('');
  const [statusOk, setStatusOk] = useState('');
  const [statusAlterandoId, setStatusAlterandoId] = useState(null);

  useEffect(() => {
    setItensLocais(itens);
  }, [itens]);

  const alterarStatus = useCallback(async (row, status) => {
    const pubId = row._apiId ?? row.id;
    if (!pubId) return;
    setStatusErro('');
    setStatusOk('');
    setStatusAlterandoId(String(pubId));
    try {
      await alterarStatusPublicacao(
        pubId,
        status,
        'Atualização operacional na aba Publicações do processo.'
      );
      setItensLocais((prev) =>
        prev.map((r) => (String(r.id) === String(row.id) ? aplicarStatusNaLinha(r, status) : r))
      );
      setStatusOk(`Status atualizado para ${STATUS_LABEL[status] || status}.`);
      notificarRelatorioAtualizado();
    } catch (e) {
      setStatusErro(e?.message || 'Falha ao atualizar status da publicação.');
    } finally {
      setStatusAlterandoId(null);
    }
  }, []);

  const lista = itensLocais;

  return (
    <>
      <div className={`${stripPad} text-sm text-slate-600 border-b border-slate-100 space-y-1`}>
        {carregando && (
          <div className="flex items-center gap-2 text-slate-700">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
            <span>Carregando publicações…</span>
          </div>
        )}
        {!carregando && erro && (
          <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-red-900">{erro}</div>
        )}
        {!carregando && statusErro && (
          <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-red-900">{statusErro}</div>
        )}
        {!carregando && statusOk && (
          <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-900">{statusOk}</div>
        )}
        {!carregando && relatorioMeta?.aviso && (
          <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-950">{relatorioMeta.aviso}</div>
        )}
        {!carregando && !lista.length && !erro && (
          <span>
            Nenhuma publicação importada vinculada a este processo. Importe PDFs em{' '}
            <strong>Processos → Publicações</strong> ou vincule manualmente ao código e proc. internos corretos.
          </span>
        )}
        {!carregando && lista.length > 0 && (
          <span>
            <strong>{lista.length}</strong> publicaç{lista.length === 1 ? 'ão' : 'ões'} colhida
            {lista.length === 1 ? '' : 's'}
            {relatorioMeta ? (
              <>
                {' '}
                ({rotuloFonte(relatorioMeta)}).
              </>
            ) : (
              '.'
            )}
          </span>
        )}
      </div>

      <div className={`flex-1 overflow-auto ${bodyPad} min-h-[8rem]`}>
        {!carregando && lista.length > 0 && (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs min-w-[1020px]">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr className="text-left">
                  <th className="p-2 w-9 text-center" title="Nº sequencial (conferência)">
                    #
                  </th>
                  <th className="p-2">Data pub.</th>
                  <th className="p-2">Data disp.</th>
                  <th className="p-2">CNJ</th>
                  <th className="p-2">Diário</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Tratamento</th>
                  <th className="p-2">Status CNJ</th>
                  <th className="p-2">Score</th>
                  <th className="p-2">Vínculo</th>
                  <th className="p-2 min-w-[180px]">Resumo</th>
                  <th className="p-2 min-w-[88px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((row, idx) => {
                  const statusTrat = statusTratamentoLinha(row);
                  const alterando = statusAlterandoId === String(row._apiId ?? row.id);
                  const jaTratada = statusTrat === 'TRATADA';
                  const ignorada = statusTrat === 'IGNORADA';
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 align-top">
                      <td className="p-2 text-center tabular-nums font-semibold text-slate-600">{idx + 1}</td>
                      <td className="p-2 whitespace-nowrap text-slate-700">{row.dataPublicacao || '—'}</td>
                      <td className="p-2 whitespace-nowrap text-slate-600">{row.dataDisponibilizacao || '—'}</td>
                      <td className="p-2 font-mono text-[11px] text-slate-800">
                        {row.processoCnjNormalizado || row.numero_processo_cnj || '—'}
                      </td>
                      <td className="p-2 text-slate-700 max-w-[140px] truncate" title={row.diario || ''}>
                        {row.diario || '—'}
                      </td>
                      <td className="p-2 text-slate-700">{row.tipoPublicacao || '—'}</td>
                      <td className="p-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeStatusTratamentoClass(statusTrat)}`}
                        >
                          {STATUS_LABEL[statusTrat] || statusTrat}
                        </span>
                      </td>
                      <td className="p-2 text-slate-700">{rotuloStatusCnj(row.statusValidacaoCnj)}</td>
                      <td className="p-2">
                        <ScoreBadge score={row.scoreConfianca} />
                      </td>
                      <td className="p-2 text-slate-700 max-w-[220px]">
                        {row.statusVinculo === 'vinculado' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-900">
                              Vinculado
                            </span>
                            <div
                              className="text-[10px] text-slate-600 truncate"
                              title={[row.cliente, row.reu].filter(Boolean).join(' · ')}
                            >
                              {formatarRotuloVinculoPartes(row)}
                            </div>
                          </div>
                        ) : (
                          row.statusVinculo || '—'
                        )}
                      </td>
                      <td className="p-2 text-slate-700 whitespace-pre-wrap break-words max-w-[280px]">
                        {row.resumoPublicacao || row.teorIntegral?.slice(0, 400) || '—'}
                      </td>
                      <td className="p-2 align-top">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            disabled={alterando || jaTratada}
                            onClick={() => void alterarStatus(row, 'TRATADA')}
                            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded border border-emerald-200 text-[10px] font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={jaTratada ? 'Publicação já tratada' : 'Marcar como tratada'}
                          >
                            {alterando ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : null}
                            {jaTratada ? 'Tratada' : 'Tratar'}
                          </button>
                          <button
                            type="button"
                            disabled={alterando || ignorada}
                            onClick={() => void alterarStatus(row, 'IGNORADA')}
                            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded border border-amber-200 text-[10px] font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Marcar como ignorada"
                          >
                            Ignorar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!featureFlags.useApiPublicacoes && lista.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-500">
            Sem API de publicações: o status é gravado apenas no armazenamento local deste navegador.
          </p>
        )}
      </div>
    </>
  );
}

/**
 * Relatório de publicações colhidas para o processo atual.
 * API-first quando `VITE_USE_API_PUBLICACOES`; caso contrário apenas localStorage (`publicacoesPorProcesso`).
 */
export function ModalRelatorioPublicacoesProcesso({
  open,
  onClose,
  /** Id numérico do processo na API (preferencial quando `useApiProcessos` populou o estado). */
  processoId,
  codigoCliente,
  processo,
  numeroProcessoNovo,
  nomeCliente,
}) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [relatorioMeta, setRelatorioMeta] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useCloseOnEscape(open, onClose);

  useEffect(() => {
    const h = () => setRefreshTick((t) => t + 1);
    window.addEventListener('vilareal:publicacoes-processo-relatorio-atualizado', h);
    return () => window.removeEventListener('vilareal:publicacoes-processo-relatorio-atualizado', h);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelado = false;
    setCarregando(true);
    setErro('');
    setRelatorioMeta(null);
    listarPublicacoesRelatorioPorProcesso({
      processoIdFromUi: processoId,
      codigoCliente,
      processo,
      numeroProcessoNovo,
    })
      .then((r) => {
        if (cancelado) return;
        setItens(r.itens || []);
        setRelatorioMeta(r);
        if (r.erro) setErro(r.erro);
      })
      .catch((e) => {
        if (cancelado) return;
        setItens([]);
        setErro(e?.message || 'Não foi possível carregar as publicações.');
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [open, processoId, codigoCliente, processo, numeroProcessoNovo, refreshTick]);

  if (!open) return null;

  const subtituloApi = featureFlags.useApiPublicacoes && Number(processoId) ? ` · Proc. API #${processoId}` : '';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-pub-processo-titulo"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col border border-slate-200">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          <div className="flex items-center gap-2 min-w-0">
            <Newspaper className="w-6 h-6 text-slate-700 shrink-0" aria-hidden />
            <div className="min-w-0">
              <h2 id="modal-pub-processo-titulo" className="text-lg font-semibold text-slate-900">
                Publicações deste processo
              </h2>
              <p className="text-sm text-slate-600 truncate">
                Cliente <span className="font-mono tabular-nums">{codigoCliente}</span>
                {' · '}
                Proc. <span className="font-mono">{processo}</span>
                {nomeCliente ? ` · ${nomeCliente}` : ''}
                {subtituloApi}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          <PublicacoesRelatorioConteudo
            itens={itens}
            carregando={carregando}
            erro={erro}
            relatorioMeta={relatorioMeta}
            compact={false}
          />
        </div>

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
