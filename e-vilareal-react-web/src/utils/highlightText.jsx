function normalizeForSearch(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function buildNormToRawMap(raw) {
  const map = [];
  for (let i = 0; i < raw.length; i += 1) {
    const normalizedChar = raw[i].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (let j = 0; j < normalizedChar.length; j += 1) {
      map.push(i);
    }
  }
  return map;
}

/**
 * Destaca ocorrências de `term` em `text` com <mark> (case-insensitive, ignora acento).
 */
export function highlightText(text, term, { active = false } = {}) {
  const raw = String(text ?? '');
  const query = String(term ?? '').trim();
  if (!raw || query.length < 2) return raw;

  const normRaw = normalizeForSearch(raw);
  const normQuery = normalizeForSearch(query);
  if (!normQuery || normRaw.length < normQuery.length) return raw;

  const normToRaw = buildNormToRawMap(raw);
  const ranges = [];
  let from = 0;
  while (from <= normRaw.length - normQuery.length) {
    const idx = normRaw.indexOf(normQuery, from);
    if (idx === -1) break;
    ranges.push([idx, idx + normQuery.length]);
    from = idx + normQuery.length;
  }
  if (ranges.length === 0) return raw;

  const markClass = active
    ? 'rounded-sm bg-amber-300/90 text-inherit ring-2 ring-amber-500 dark:bg-amber-400/80'
    : 'rounded-sm bg-yellow-200/90 text-inherit dark:bg-yellow-500/40';

  const parts = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    const rawStart = normToRaw[start] ?? start;
    const rawEnd = (normToRaw[end - 1] ?? end - 1) + 1;
    if (rawStart > cursor) {
      parts.push(<span key={`t-${i}-pre`}>{raw.slice(cursor, rawStart)}</span>);
    }
    parts.push(
      <mark key={`m-${i}`} className={markClass}>
        {raw.slice(rawStart, rawEnd)}
      </mark>,
    );
    cursor = rawEnd;
  });
  if (cursor < raw.length) {
    parts.push(<span key="tail">{raw.slice(cursor)}</span>);
  }
  return parts;
}
