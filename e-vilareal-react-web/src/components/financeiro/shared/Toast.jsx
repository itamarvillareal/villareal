import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { X } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  SUCESSO: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-100',
  INFO: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100',
  AVISO: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100',
  ERRO: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100',
};

const DURATIONS = { SUCESSO: 3000, INFO: 5000, AVISO: 8000, ERRO: 0 };

export function FinanceiroToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (tipo, mensagem, opts = {}) => {
      const id = crypto.randomUUID?.() ?? String(Date.now() + Math.random());
      const entry = { id, tipo, mensagem, actionLabel: opts.actionLabel, onAction: opts.onAction };
      setItems((prev) => [...prev.slice(-2), entry]);
      const ms = DURATIONS[tipo] ?? 5000;
      if (ms > 0) {
        window.setTimeout(() => dismiss(id), ms);
      }
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toast,
      success: (msg, opts) => toast('SUCESSO', msg, opts),
      info: (msg, opts) => toast('INFO', msg, opts),
      warn: (msg, opts) => toast('AVISO', msg, opts),
      error: (msg, opts) => toast('ERRO', msg, opts),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg border px-3 py-2 text-sm shadow-lg flex gap-2 items-start ${STYLES[t.tipo] ?? STYLES.INFO}`}
          >
            <div className="flex-1 min-w-0">
              <p>{t.mensagem}</p>
              {t.actionLabel && t.onAction ? (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium underline"
                  onClick={() => {
                    t.onAction();
                    dismiss(t.id);
                  }}
                >
                  {t.actionLabel}
                </button>
              ) : null}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="shrink-0 opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useFinanceiroToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useFinanceiroToast deve ser usado dentro de FinanceiroToastProvider');
  return ctx;
}
