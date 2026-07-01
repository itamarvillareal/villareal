import { useCallback, useEffect, useState } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import {
  getWhatsAppIaHabilitada,
  putWhatsAppIaHabilitada,
} from '../../../repositories/whatsappRepository.js';
import { useWhatsAppToast } from '../WhatsAppToast.jsx';

export function WhatsAppIaToggle() {
  const toast = useWhatsAppToast();
  const [habilitada, setHabilitada] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async (signal) => {
    setCarregando(true);
    try {
      const dto = await getWhatsAppIaHabilitada(signal);
      setHabilitada(Boolean(dto?.habilitada));
    } catch (err) {
      if (err?.name !== 'AbortError') {
        toast.error(err?.message || 'Falha ao carregar configuração da IA.');
      }
    } finally {
      setCarregando(false);
    }
  }, [toast]);

  useEffect(() => {
    const ac = new AbortController();
    void carregar(ac.signal);
    return () => ac.abort();
  }, [carregar]);

  async function alternar() {
    if (salvando || carregando) return;
    const novo = !habilitada;
    setSalvando(true);
    try {
      const dto = await putWhatsAppIaHabilitada(novo);
      setHabilitada(Boolean(dto?.habilitada));
      toast.success(
        dto?.habilitada
          ? 'Resposta automática com IA ligada.'
          : 'Resposta automática com IA desligada.',
      );
    } catch (err) {
      toast.error(err?.message || 'Falha ao atualizar a IA.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-lg border border-emerald-200/60 dark:border-emerald-500/25 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2.5">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          checked={habilitada}
          disabled={carregando || salvando}
          onChange={() => void alternar()}
        />
        <Bot className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden />
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
          Resposta automática com IA
        </span>
        {carregando || salvando ? (
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600 ml-auto shrink-0" aria-hidden />
        ) : (
          <span
            className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
              habilitada
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {habilitada ? 'Ligada' : 'Desligada'}
          </span>
        )}
      </label>
      {!habilitada && !carregando ? (
        <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
          Desligada: mensagens recebidas ficam só no histórico; nenhuma resposta automática é enviada.
          Respostas manuais na aba Conversas continuam funcionando.
        </p>
      ) : null}
    </div>
  );
}
