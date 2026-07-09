import { Pencil, Trash2 } from 'lucide-react';

function formatarDataIsoParaBr(iso) {
  const s = String(iso ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s || '—';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * @param {{
 *   lotes: Array,
 *   loteAtivo?: string,
 *   onEditar: (loteRef: string) => void,
 *   onCancelar: (loteRef: string) => void,
 *   onNovo: () => void,
 *   compacto?: boolean,
 * }} props
 */
export function AgendaLotesPainel({ lotes = [], loteAtivo = '', onEditar, onCancelar, onNovo, compacto = false }) {
  const lista = Array.isArray(lotes) ? lotes : [];

  if (compacto) {
    return (
      <section className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 px-3 py-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-900">Agendamentos em lote</h3>
          <button
            type="button"
            onClick={onNovo}
            className="rounded-lg border border-indigo-300 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-50"
          >
            Novo lote
          </button>
        </div>
        {lista.length === 0 ? (
          <p className="text-xs text-indigo-800/80">Nenhum lote salvo ainda.</p>
        ) : (
          <ul className="max-h-36 space-y-1.5 overflow-y-auto">
            {lista.map((l) => {
              const ref = String(l.loteRef ?? '');
              const ativo = ref && ref === String(loteAtivo ?? '');
              const titulo = String(l.textoBase ?? '').trim() || 'Sem descrição';
              const de = formatarDataIsoParaBr(l.primeiraData);
              const ate = formatarDataIsoParaBr(l.ultimaData);
              return (
                <li
                  key={ref}
                  className={`flex items-start justify-between gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                    ativo ? 'border-indigo-500 bg-white shadow-sm' : 'border-indigo-200/70 bg-white/70'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{titulo}</p>
                    <p className="text-[11px] text-slate-600">
                      {de} → {ate} · {l.qtdLinhas ?? 0} data(s) · {l.qtdEventos ?? 0} compromisso(s)
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      title="Editar lote"
                      aria-label="Editar lote"
                      onClick={() => onEditar(ref)}
                      className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Cancelar lote"
                      aria-label="Cancelar lote"
                      onClick={() => onCancelar(ref)}
                      className="flex h-7 w-7 items-center justify-center rounded border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  return null;
}
