import { useRef } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';
import {
  WHATSAPP_MEDIA_ACCEPT,
  categoriaAceitaCaption,
  handleAttachSelect,
  validarArquivoWhatsAppMedia,
} from '../utils/whatsappMediaSendUtils.js';

/**
 * Botão de anexo + seleção de arquivo + caption opcional (sem preview otimista — Passo 4).
 */
export function WhatsAppMediaAttachComposer({
  selectedFile,
  onSelectFile,
  onClearFile,
  mediaCaption,
  onMediaCaptionChange,
  disabled = false,
  clipBtnClass = '',
  inputClass = '',
  showClip = true,
  showPreview = true,
}) {
  const fileInputRef = useRef(null);
  const validation = selectedFile ? validarArquivoWhatsAppMedia(selectedFile) : null;
  const categoria = validation?.ok ? validation.categoria : null;
  const showCaption = categoria && categoriaAceitaCaption(categoria);

  const handlePick = () => {
    if (!disabled) fileInputRef.current?.click();
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    const result = handleAttachSelect(file);
    if (!result.ok) {
      onSelectFile?.(null, result.erro);
      return;
    }
    onSelectFile?.(result.file, null);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={WHATSAPP_MEDIA_ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={handleChange}
      />
      {showClip ? (
        <button
          type="button"
          onClick={handlePick}
          disabled={disabled}
          className={
            clipBtnClass ||
            'inline-flex shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
          }
          title="Anexar imagem, documento, áudio ou vídeo"
          aria-label="Anexar arquivo"
        >
          <Paperclip className="h-4 w-4" />
        </button>
      ) : null}
      {showPreview && selectedFile ? (
        <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-2.5 py-2 space-y-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="flex-1 min-w-0 text-xs font-medium text-emerald-900 dark:text-emerald-100 truncate"
              title={selectedFile.name}
            >
              {selectedFile.name}
            </span>
            <button
              type="button"
              onClick={onClearFile}
              disabled={disabled}
              className="shrink-0 rounded p-0.5 text-emerald-800 hover:bg-emerald-100/80 dark:text-emerald-200 disabled:opacity-50"
              aria-label="Remover anexo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {validation && !validation.ok ? (
            <p className="text-[11px] text-red-600 dark:text-red-400">{validation.erro}</p>
          ) : null}
          {showCaption ? (
            <input
              type="text"
              className={
                inputClass ||
                'w-full rounded-lg border border-emerald-200/80 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
              }
              value={mediaCaption}
              onChange={(e) => onMediaCaptionChange?.(e.target.value)}
              placeholder="Legenda (opcional)"
              disabled={disabled}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function WhatsAppMediaSendingIndicator({ sending }) {
  if (!sending) return null;
  return (
    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 px-1 inline-flex items-center gap-1">
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      Enviando mídia…
    </p>
  );
}
