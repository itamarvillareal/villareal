import { useRef } from 'react';
import { Loader2, Paperclip } from 'lucide-react';
import {
  WHATSAPP_MEDIA_ACCEPT,
  handleAttachSelect,
} from '../utils/whatsappMediaSendUtils.js';
import { WhatsAppMediaAttachPreview } from './WhatsAppMediaAttachPreview.jsx';

/**
 * Botão de anexo + seleção de arquivo + caption opcional + preview com thumbnail.
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
        <WhatsAppMediaAttachPreview
          selectedFile={selectedFile}
          onClearFile={onClearFile}
          mediaCaption={mediaCaption}
          onMediaCaptionChange={onMediaCaptionChange}
          disabled={disabled}
          inputClass={inputClass}
        />
      ) : null}
    </>
  );
}

export { WhatsAppMediaAttachPreview } from './WhatsAppMediaAttachPreview.jsx';

export function WhatsAppMediaSendingIndicator({ sending }) {
  if (!sending) return null;
  return (
    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 px-1 inline-flex items-center gap-1">
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      Enviando mídia…
    </p>
  );
}
