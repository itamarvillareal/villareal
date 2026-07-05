import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  bancosFiltroAtivo,
  normalizarBancosFiltro,
  rotuloBancosFiltro,
} from './inboxBancosFiltro.js';

export function InboxBancosFiltro({ bancos = [], bancosCatalogo = [], onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selecionados = normalizarBancosFiltro(bancos);
  const ativo = bancosFiltroAtivo(selecionados);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggleBanco = (numero) => {
    const set = new Set(selecionados);
    if (set.has(numero)) set.delete(numero);
    else set.add(numero);
    onChange([...set].sort((a, b) => a - b));
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md border min-w-[10rem] ${
          ativo
            ? 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/50 dark:border-indigo-700 dark:text-indigo-200'
            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Filtrar bancos"
      >
        <span className="truncate">{rotuloBancosFiltro(selecionados, bancosCatalogo)}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-40 mt-1 w-[min(18rem,calc(100vw-1.5rem))] max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-2"
          role="dialog"
          aria-label="Selecionar bancos"
        >
          <div className="flex items-center justify-between gap-2 mb-2 px-1">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Bancos</p>
            {ativo ? (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] text-indigo-700 dark:text-indigo-300 hover:underline"
              >
                Limpar
              </button>
            ) : null}
          </div>
          <ul className="space-y-0.5">
            {bancosCatalogo.map((b) => {
              const n = Number(b.numero);
              const checked = selecionados.includes(n);
              return (
                <li key={n}>
                  <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBanco(n)}
                      className="rounded border-slate-300"
                    />
                    <span className="truncate">{b.nome}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
