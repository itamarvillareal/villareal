import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CONTAS_LETRAS, nomeContaPorLetra } from '../constants/financeiroConstants.js';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import {
  LETRAS_MODO_EXCLUIR,
  LETRAS_MODO_INCLUIR,
  letrasFiltroAtivo,
  rotuloLetrasFiltro,
} from './extratoLetrasFiltro.js';

export function LetrasFiltroExtrato({ letras = [], letrasModo = LETRAS_MODO_INCLUIR, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggleLetra = (cod) => {
    const set = new Set(letras);
    if (set.has(cod)) set.delete(cod);
    else set.add(cod);
    onChange([...set].sort((a, b) => a.localeCompare(b, 'pt-BR')), letrasModo);
  };

  const ativo = letrasFiltroAtivo({ letras });

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border ${
          ativo
            ? 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/50 dark:border-indigo-700 dark:text-indigo-200'
            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Filtrar por letra da conta contábil"
      >
        {rotuloLetrasFiltro({ letras, letrasModo })}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-40 mt-1 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-3"
          role="dialog"
          aria-label="Filtro de letras da conta"
        >
          <fieldset className="mb-3">
            <legend className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Modo
            </legend>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => onChange(letras, LETRAS_MODO_INCLUIR)}
                className={`text-xs px-2 py-0.5 rounded-md border ${
                  letrasModo === LETRAS_MODO_INCLUIR
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                Somente selecionadas
              </button>
              <button
                type="button"
                onClick={() => onChange(letras, LETRAS_MODO_EXCLUIR)}
                className={`text-xs px-2 py-0.5 rounded-md border ${
                  letrasModo === LETRAS_MODO_EXCLUIR
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                Exceto selecionadas
              </button>
            </div>
          </fieldset>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
            Clique nas letras para combinar o filtro (ex.: só A, ou todas menos E).
          </p>

          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {CONTAS_LETRAS.map((cod) => {
              const sel = letras.includes(cod);
              return (
                <button
                  key={cod}
                  type="button"
                  onClick={() => toggleLetra(cod)}
                  className={`rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                    sel ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900' : 'opacity-80 hover:opacity-100'
                  }`}
                  title={`${nomeContaPorLetra(cod) ?? cod}${sel ? ' (selecionada)' : ''}`}
                  aria-pressed={sel}
                >
                  <ContaBadge codigo={cod} />
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex justify-end gap-2">
            {ativo ? (
              <button
                type="button"
                onClick={() => {
                  onChange([], LETRAS_MODO_INCLUIR);
                  setOpen(false);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Limpar
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
