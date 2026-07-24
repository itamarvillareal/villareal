import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  VALOR_FILTRO_EXATO,
  VALOR_FILTRO_GT0,
  VALOR_FILTRO_LT0,
  VALOR_FILTRO_TODOS,
  parseValorExtratoBr,
  rotuloValorFiltro,
} from './extratoValorFiltro.js';

export function ExtratoValorFiltro({ valorFiltro, valorExato, onChange }) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState('');
  const rootRef = useRef(null);

  const ativo = valorFiltro && valorFiltro !== VALOR_FILTRO_TODOS;

  useEffect(() => {
    if (!aberto) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setAberto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [aberto]);

  useEffect(() => {
    if (valorFiltro === VALOR_FILTRO_EXATO && valorExato != null) {
      setRascunho(
        new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
          Number(valorExato),
        ),
      );
    }
  }, [valorFiltro, valorExato]);

  function aplicarExato() {
    const n = parseValorExtratoBr(rascunho);
    if (n == null || n === 0) return;
    onChange?.(VALOR_FILTRO_EXATO, n);
    setAberto(false);
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border ${
          ativo
            ? 'border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:border-sky-700 dark:text-sky-200'
            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-label="Filtrar por valor"
      >
        {rotuloValorFiltro({ valorFiltro, valorExato })}
        <ChevronDown className="w-3 h-3 opacity-70" aria-hidden />
      </button>

      {aberto ? (
        <div
          className="absolute z-30 top-full left-0 mt-1 w-56 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-2 text-xs"
          role="dialog"
          aria-label="Opções de filtro de valor"
        >
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              className={`text-left rounded px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                !ativo ? 'bg-slate-100 dark:bg-slate-800 font-medium' : ''
              }`}
              onClick={() => {
                onChange?.(VALOR_FILTRO_TODOS, null);
                setAberto(false);
              }}
            >
              Todos os valores
            </button>
            <button
              type="button"
              className={`text-left rounded px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                valorFiltro === VALOR_FILTRO_LT0 ? 'bg-slate-100 dark:bg-slate-800 font-medium' : ''
              }`}
              onClick={() => {
                onChange?.(VALOR_FILTRO_LT0, null);
                setAberto(false);
              }}
            >
              Menor que zero (débitos)
            </button>
            <button
              type="button"
              className={`text-left rounded px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                valorFiltro === VALOR_FILTRO_GT0 ? 'bg-slate-100 dark:bg-slate-800 font-medium' : ''
              }`}
              onClick={() => {
                onChange?.(VALOR_FILTRO_GT0, null);
                setAberto(false);
              }}
            >
              Maior que zero (créditos)
            </button>
          </div>
          <div className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1" htmlFor="filtro-valor-exato-extrato">
              Valor exato (R$)
            </label>
            <div className="flex gap-1">
              <input
                id="filtro-valor-exato-extrato"
                type="text"
                inputMode="decimal"
                placeholder="ex.: -1.500,00"
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    aplicarExato();
                  }
                }}
                className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                className="px-2 py-1 rounded bg-sky-600 text-white hover:bg-sky-700 shrink-0"
                onClick={aplicarExato}
              >
                Aplicar
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Use sinal negativo para débitos (ex.: -50,00).
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
