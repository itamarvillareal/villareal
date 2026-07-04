const TZ_BR = 'America/Sao_Paulo';

function formatPreviewTime() {
  return new Date().toLocaleString('pt-BR', {
    timeZone: TZ_BR,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderPreviewText(text) {
  const parts = String(text).split(/(\{\{\d+\}\})/g);
  return parts.map((part, i) =>
    /^\{\{\d+\}\}$/.test(part) ? (
      <span key={i} className="rounded bg-white/25 px-0.5 font-medium">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function MessageComposePreview({
  text,
  templateName,
  emptyHint = 'A mensagem aparecerá aqui conforme você preenche os campos.',
}) {
  const timeLabel = formatPreviewTime();
  const content = String(text ?? '').trim();
  const hasContent = content.length > 0;

  return (
    <aside
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-4"
      aria-label="Pré-visualização da mensagem"
    >
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Preview
      </p>
      <div
        className="min-h-[220px] rounded-lg p-4"
        style={{
          backgroundColor: '#e5ddd5',
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.25) 0%, transparent 45%)',
        }}
      >
        {hasContent ? (
          <div className="flex justify-end">
            <div className="max-w-[90%] rounded-2xl rounded-br-md bg-[#25D366] px-3 py-2 text-white shadow-sm">
              {templateName ? (
                <span className="mb-1 inline-block rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Template: {templateName}
                </span>
              ) : null}
              <p className="whitespace-pre-wrap break-words text-sm">{renderPreviewText(content)}</p>
              <div className="mt-1 flex items-center justify-end gap-1 text-white/80">
                <span className="text-[11px]">{timeLabel}</span>
                <span className="text-[11px]" aria-hidden>
                  ✓
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-600">{emptyHint}</p>
        )}
      </div>
    </aside>
  );
}
