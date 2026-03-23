import { X, Newspaper } from 'lucide-react';
import { listarPublicacoesDoProcesso } from '../data/publicacoesPorProcesso.js';

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

/**
 * Relatório de publicações colhidas (importação confirmada) para o processo atual.
 */
export function ModalRelatorioPublicacoesProcesso({
  open,
  onClose,
  codigoCliente,
  processo,
  numeroProcessoNovo,
  nomeCliente,
}) {
  if (!open) return null;

  const itens = listarPublicacoesDoProcesso(codigoCliente, processo, numeroProcessoNovo);

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

        <div className="px-4 py-2 text-sm text-slate-600 border-b border-slate-100">
          {itens.length === 0 ? (
            <span>
              Nenhuma publicação importada vinculada a este processo. Importe PDFs em{' '}
              <strong>Processos → Publicações</strong> ou vincule manualmente ao código e proc. internos corretos.
            </span>
          ) : (
            <span>
              <strong>{itens.length}</strong> publicaç{itens.length === 1 ? 'ão' : 'ões'} colhida
              {itens.length === 1 ? '' : 's'} (armazenamento local).
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {itens.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs min-w-[900px]">
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
                    <th className="p-2">Status CNJ</th>
                    <th className="p-2">Score</th>
                    <th className="p-2">Vínculo</th>
                    <th className="p-2 min-w-[220px]">Resumo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itens.map((row, idx) => (
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
                      <td className="p-2 text-slate-700">{rotuloStatusCnj(row.statusValidacaoCnj)}</td>
                      <td className="p-2">
                        <ScoreBadge score={row.scoreConfianca} />
                      </td>
                      <td className="p-2 text-slate-700">
                        {row.statusVinculo === 'vinculado' ? (
                          <span className="text-emerald-800">Vinculado</span>
                        ) : (
                          row.statusVinculo || '—'
                        )}
                      </td>
                      <td className="p-2 text-slate-700 whitespace-pre-wrap break-words">
                        {row.resumoPublicacao || row.teorIntegral?.slice(0, 400) || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
