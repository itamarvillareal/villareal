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

export function WhatsAppToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (tipo, mensagem) => {
      const id = crypto.randomUUID?.() ?? String(Date.now() + Math.random());
      setItems((prev) => [...prev.slice(-2), { id, tipo, mensagem }]);
      const ms = DURATIONS[tipo] ?? 5000;
      if (ms > 0) window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toast,
      success: (msg) => toast('SUCESSO', msg),
      info: (msg) => toast('INFO', msg),
      warn: (msg) => toast('AVISO', msg),
      error: (msg) => toast('ERRO', msg),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg border px-3 py-2 text-sm shadow-lg flex gap-2 items-start ${STYLES[t.tipo] ?? STYLES.INFO}`}
          >
            <p className="flex-1 min-w-0">{t.mensagem}</p>
            <button type="button" onClick={() => dismiss(t.id)} className="shrink-0 opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useWhatsAppToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useWhatsAppToast deve ser usado dentro de WhatsAppToastProvider');
  return ctx;
}
