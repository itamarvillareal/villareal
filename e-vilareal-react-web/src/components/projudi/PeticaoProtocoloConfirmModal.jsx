import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * @param {{
 *   open: boolean,
 *   titulo?: string,
 *   processoLabel?: string,
 *   previa: object | null,
 *   carregandoPrevia?: boolean,
 *   confirmando?: boolean,
 *   onCancel: () => void,
 *   onConfirmar: () => void,
 * }} props
 */
export function PeticaoProtocoloConfirmModal({
  open,
  titulo = 'Confirmar protocolo',
  processoLabel,
  previa,
  carregandoPrevia = false,
  confirmando = false,
  onCancel,
  onConfirmar,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full p-4 space-y-3 max-h-[90dvh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-base font-semibold flex items-center gap-2 text-slate-900">
          <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden />
          {titulo}
        </h3>
        {processoLabel ? (
          <p className="text-sm text-slate-700">
            Processo <strong className="font-mono">{processoLabel}</strong>. O passo <strong>Concluir</strong> é{' '}
            <strong>irreversível</strong>.
          </p>
        ) : (
          <p className="text-sm text-slate-700">
            O passo <strong>Concluir</strong> no PROJUDI é <strong>irreversível</strong>.
          </p>
        )}

        {carregandoPrevia ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            Montando plano de juntada…
          </div>
        ) : previa ? (
          <div className="space-y-2 text-sm">
            <p>
              <strong>{previa.quantidadeJuntadas}</strong> juntada(s),{' '}
              <strong>{previa.quantidadeArquivos}</strong> arquivo(s).
            </p>
            {(previa.juntadas || []).map((j, idx) => (
              <div key={idx} className="rounded border border-slate-200 bg-slate-50 p-2 space-y-1">
                <div className="text-xs font-medium text-slate-600">
                  Juntada {idx + 1}
                  {j.peticaoIds?.length ? ` · petições ${j.peticaoIds.join(', ')}` : ''}
                </div>
                <ol className="list-decimal list-inside text-xs text-slate-700">
                  {(j.arquivos || []).map((a) => (
                    <li key={`${a.peticaoId}-${a.ordemNaJuntada}`}>
                      {a.nomeOriginal} ({a.tipoLabel})
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {(previa.avisosGerais || []).map((aviso) => (
              <p key={aviso} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                {aviso}
              </p>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            disabled={confirmando}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50"
            disabled={confirmando}
            onClick={onConfirmar}
          >
            {confirmando ? (
              <Loader2 className="w-4 h-4 inline animate-spin mr-1" aria-hidden />
            ) : (
              <CheckCircle2 className="w-4 h-4 inline mr-1" aria-hidden />
            )}
            {confirmando ? 'Protocolando…' : 'Concluir e protocolar'}
          </button>
        </div>
      </div>
    </div>
  );
}
