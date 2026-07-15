import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Forward, Loader2, Search, X } from 'lucide-react';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import {
  encaminharMensagensWhatsApp,
  searchWhatsAppConversations,
} from '../../../repositories/whatsappRepository.js';
import { formatPhoneDisplay, normalizePhoneForApi } from '../../../utils/whatsappFormat.js';
import { resumoWhatsAppMessageContent } from '../utils/whatsappMessagePreview.js';
import { processosBtnPrimary, processosInputClass } from '../../processos/ProcessosAdminLayout.jsx';

export function EncaminharMensagemModal({
  open,
  messages,
  sourcePhoneNumber,
  onClose,
  onSuccess,
}) {
  const [termo, setTermo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [destino, setDestino] = useState(null);
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  const lista = useMemo(
    () => (Array.isArray(messages) ? messages.filter((m) => m?.id > 0) : []),
    [messages],
  );

  const sourceNormalized = useMemo(
    () => normalizePhoneForApi(sourcePhoneNumber),
    [sourcePhoneNumber],
  );

  const preview = useMemo(() => {
    if (lista.length === 0) return '';
    if (lista.length === 1) {
      const m = lista[0];
      return resumoWhatsAppMessageContent(m.messageType, m.content);
    }
    const amostra = lista.slice(0, 3).map((m) => resumoWhatsAppMessageContent(m.messageType, m.content));
    const restante = lista.length - amostra.length;
    if (restante > 0) {
      return `${amostra.join(' · ')} · e mais ${restante}`;
    }
    return amostra.join(' · ');
  }, [lista]);

  const singleMedia = useMemo(() => {
    if (lista.length !== 1) return false;
    const type = String(lista[0]?.messageType ?? '').toUpperCase();
    return ['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'].includes(type);
  }, [lista]);

  const reset = useCallback(() => {
    setTermo('');
    setResultados([]);
    setDestino(null);
    setCaption('');
    setError('');
    setBuscando(false);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return undefined;
    }
    return undefined;
  }, [open, reset]);

  useCloseOnEscape(open, onClose, { enabled: !sending });

  useEffect(() => {
    if (!open) return undefined;
    const q = termo.trim();
    if (q.length < 2) {
      setResultados([]);
      setBuscando(false);
      return undefined;
    }
    setBuscando(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      searchWhatsAppConversations(q, controller.signal)
        .then((items) => {
          const itens = Array.isArray(items) ? items : [];
          setResultados(
            itens.filter((item) => normalizePhoneForApi(item.phoneNumber) !== sourceNormalized),
          );
        })
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
      return () => controller.abort();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [termo, open, sourceNormalized]);

  const handleSubmit = async () => {
    if (lista.length === 0 || !destino?.phoneNumber) return;
    setSending(true);
    setError('');
    try {
      const messageIds = lista.map((m) => m.id);
      const captionByMessageId =
        singleMedia && caption.trim() ? { [lista[0].id]: caption.trim() } : undefined;

      const batch = await encaminharMensagensWhatsApp(messageIds, {
        phoneNumbers: [destino.phoneNumber],
        captionByMessageId,
      });

      const failed = batch.filter((item) => {
        const results = Array.isArray(item.response?.results) ? item.response.results : [];
        return results.some((r) => !r.success) || item.error;
      });

      if (failed.length > 0) {
        const first = failed[0];
        const apiError =
          first.error ||
          first.response?.results?.find((r) => !r.success)?.error ||
          'Falha ao encaminhar mensagem.';
        setError(
          failed.length === 1
            ? apiError
            : `${failed.length} de ${lista.length} mensagens falharam. ${apiError}`,
        );
        return;
      }

      onSuccess?.({ batch, destino }, destino);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Falha ao encaminhar mensagens.');
    } finally {
      setSending(false);
    }
  };

  if (!open || lista.length === 0) return null;

  const titulo =
    lista.length === 1 ? 'Encaminhar mensagem' : `Encaminhar ${lista.length} mensagens`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-forward-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              id="whatsapp-forward-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"
            >
              <Forward className="h-4 w-4" aria-hidden />
              {titulo}
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-4">{preview}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Destinatário
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
                setDestino(null);
              }}
              placeholder="Buscar conversa por nome ou telefone…"
              className={`${processosInputClass} pl-9`}
              disabled={sending}
            />
          </div>

          {destino ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {destino.contactName || 'Contato'}
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                {formatPhoneDisplay(destino.phoneNumber)}
              </p>
            </div>
          ) : null}

          {buscando ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando…
            </div>
          ) : null}

          {!destino && resultados.length > 0 ? (
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
              {resultados.map((item) => (
                <li key={item.phoneNumber}>
                  <button
                    type="button"
                    onClick={() => setDestino(item)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {item.contactName || 'Contato'}
                    </span>
                    <span className="block text-slate-500 dark:text-slate-400">
                      {formatPhoneDisplay(item.phoneNumber)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {singleMedia ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Legenda (opcional)
              </span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                className={`${processosInputClass} mt-1 w-full resize-none`}
                placeholder="Deixe em branco para manter a legenda original"
                disabled={sending}
              />
            </label>
          ) : null}

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || !destino}
            className={processosBtnPrimary}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                Encaminhando…
              </>
            ) : (
              'Encaminhar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
