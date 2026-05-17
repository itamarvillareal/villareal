const LEVELS = {
  ALTA: { filled: 3, color: 'var(--fin-confianca-alta)' },
  MEDIA: { filled: 2, color: 'var(--fin-confianca-media)' },
  BAIXA: { filled: 1, color: 'var(--fin-confianca-baixa)' },
};

export function ConfiancaDots({ nivel = 'MEDIA' }) {
  const cfg = LEVELS[String(nivel).toUpperCase()] ?? LEVELS.MEDIA;

  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i >= cfg.filled ? 'bg-slate-200 dark:bg-slate-700' : ''
          }`}
          style={i < cfg.filled ? { background: cfg.color } : undefined}
        />
      ))}
    </span>
  );
}
