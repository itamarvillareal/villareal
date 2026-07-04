import { useEffect, useMemo, useState } from 'react';
import { FileText, Film, Music, X } from 'lucide-react';
import {
  categoriaAceitaCaption,
  validarArquivoWhatsAppMedia,
} from '../utils/whatsappMediaSendUtils.js';

function previewIconForCategoria(categoria) {
  if (categoria === 'video') return Film;
  if (categoria === 'audio') return Music;
  return FileText;
}

/**
 * Preview de anexo antes do envio (nome, thumbnail para imagem, legenda, cancelar).
 * Revoga objectURL ao trocar/remover arquivo ou desmontar.
 */
export function WhatsAppMediaAttachPreview({
  selectedFile,
  onClearFile,
  mediaCaption,
  onMediaCaptionChange,
  disabled = false,
  inputClass = '',
  containerClass = '',
}) {
  const validation = selectedFile ? validarArquivoWhatsAppMedia(selectedFile) : null;
  const categoria = validation?.ok ? validation.categoria : null;
  const showCaption = categoria && categoriaAceitaCaption(categoria);
  const isImage = categoria === 'image';
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!selectedFile || !isImage) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile, isImage]);

  const TypeIcon = useMemo(() => previewIconForCategoria(categoria), [categoria]);

  if (!selectedFile) return null;

  return (
    <div
      className={
        containerClass ||
        'rounded-lg border border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-2.5 py-2 space-y-1.5'
      }
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg border border-emerald-200/80 object-cover bg-white dark:border-slate-600 dark:bg-slate-800"
          />
        ) : categoria ? (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-emerald-200/80 bg-white text-emerald-700 dark:border-slate-600 dark:bg-slate-800 dark:text-emerald-300"
            aria-hidden
          >
            <TypeIcon className="h-6 w-6" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1.5">
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
      </div>
    </div>
  );
}
