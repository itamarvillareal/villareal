/**
 * Corrige mojibake UTF-8/Latin-1 (alinhado a {@code Utf8MojibakeUtil} no backend).
 * Usar ao exibir ou gravar texto vindo da API / localStorage legado.
 */

function latin1Somente(str) {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 0xff) return false;
  }
  return true;
}

function temCjkProvavel(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x4e00 && c <= 0x9fff) return true;
    if (c >= 0x3040 && c <= 0x30ff) return true;
    if (c >= 0xac00 && c <= 0xd7af) return true;
  }
  return false;
}

function temParSurrogatoUtf16(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) return true;
  }
  return false;
}

function temBlocoBoxDrawingOuSubstituicao(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x2500 && c <= 0x257f) return true;
    if (c === 0xfffd) return true;
  }
  return false;
}

function temSequenciaMojibakeLatinEstendido(s) {
  if (s.length < 2) return false;
  if (s.includes('Ã') || s.includes('â€')) return true;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s.charCodeAt(i);
    const b = s.charCodeAt(i + 1);
    if (a === 0xc3 && b > 0x20) return true;
    if (a === 0xc2 && (b === 0xa9 || b === 0xae || b === 0xb0 || b === 0xaa || b === 0xa2)) return true;
  }
  return false;
}

function deveTentarReverterDuplaCamada(s) {
  if (latin1Somente(s)) return false;
  if (temCjkProvavel(s)) return false;
  if (temParSurrogatoUtf16(s)) return false;
  return temBlocoBoxDrawingOuSubstituicao(s) || temSequenciaMojibakeLatinEstendido(s);
}

function decodificarLatin1ComoUtf8Leniente(s) {
  if (!latin1Somente(s)) return s;
  const bytes = new Uint8Array(s.length);
  for (let j = 0; j < s.length; j++) bytes[j] = s.charCodeAt(j) & 0xff;
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function corrigirLatin1Utf8EmCadeia(s) {
  let cur = s;
  for (let pass = 0; pass < 6; pass++) {
    if (!latin1Somente(cur)) return cur;
    const bytes = new Uint8Array(cur.length);
    for (let j = 0; j < cur.length; j++) bytes[j] = cur.charCodeAt(j) & 0xff;
    let next;
    try {
      next = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return cur;
    }
    if (next === cur) return cur;
    cur = next;
  }
  return cur;
}

function pontuacaoLegivelPortugues(s) {
  let sc = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if ((c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a) || (c >= 0x30 && c <= 0x39)) sc += 4;
    else if (c === 0x20 || c === 0x2e || c === 0x2c || c === 0x2d || c === 0x2f || c === 0x28 || c === 0x29)
      sc += 1;
    else if (c >= 0xc0 && c <= 0x24f) sc += 3;
    else if (c === 0xba || c === 0xaa) sc += 3;
    if (c >= 0x2500 && c <= 0x257f) sc -= 40;
    if (c === 0xfffd) sc -= 20;
  }
  return sc;
}

function reverterDuplaComTabelaLatin(b2, decodeLatin) {
  const latin = decodeLatin(b2);
  if (!latin1Somente(latin)) return null;
  let fixed = corrigirLatin1Utf8EmCadeia(latin);
  if (fixed === latin) {
    const leniente = decodificarLatin1ComoUtf8Leniente(latin);
    if (leniente !== latin) fixed = corrigirLatin1Utf8EmCadeia(leniente);
  }
  if (fixed === latin) return null;
  return fixed;
}

function escolherMelhorCandidatoDupla(original, a, b) {
  let best = null;
  let bestScore = Number.MIN_SAFE_INTEGER;
  for (const cand of [a, b]) {
    if (cand == null || cand === original) continue;
    const sc = pontuacaoLegivelPortugues(cand);
    if (sc > bestScore) {
      bestScore = sc;
      best = cand;
    }
  }
  return best;
}

function substituirClustersBlocoDesenhoU251c(s) {
  if (s == null || s.length === 0) return s;
  if (!s.includes('\u251c')) return s;
  let t = s;
  t = t.replaceAll('\u251c\u00e2\u00d4\u00c7\u00ed\u251c\u00e2\u00e3\u00c6', '\u00c7\u00c3');
  t = t.replaceAll('\u251c\u00e2\u00d4\u00c7\u2019', '\u00c9');
  t = t.replaceAll('\u251c\u00e2\u00d4\u00c7\u0027', '\u00c9');
  t = t.replaceAll('\u251c\u00e2\u00d4\u00c7\u2591', '\u00c9');
  t = t.replaceAll('\u251c\u00e2\u00e3\u00c6', '\u00c3');
  t = t.replaceAll('\u251c\u00e9\u252c\u00ac', '\u00aa');
  t = t.replaceAll('\u251c\u00e9\u00ac\u00aa', '\u00aa');
  return t;
}

function tentarUmaPassagemDuplaCodificacaoUtf8(s) {
  try {
    const b2 = new TextEncoder().encode(s);
    const iso = reverterDuplaComTabelaLatin(b2, (buf) => {
      let latin = '';
      for (let i = 0; i < buf.length; i++) latin += String.fromCharCode(buf[i]);
      return latin;
    });
    let cp = null;
    try {
      cp = reverterDuplaComTabelaLatin(b2, (buf) => new TextDecoder('windows-1252').decode(buf));
    } catch {
      /* opcional */
    }
    return escolherMelhorCandidatoDupla(s, iso, cp);
  } catch {
    return null;
  }
}

const MOJIBAKE_PLANILHA_UTF8 = [
  ['\u00c3\u2021', '\u00c7'],
  ['\u00c3\u0192', '\u00c3'],
  ['\u00c3\u00a1', '\u00e1'],
  ['\u00c3\u00a2', '\u00e2'],
  ['\u00c3\u00a3', '\u00e3'],
  ['\u00c3\u00a9', '\u00e9'],
  ['\u00c3\u00aa', '\u00ea'],
  ['\u00c3\u00ad', '\u00ed'],
  ['\u00c3\u00b3', '\u00f3'],
  ['\u00c3\u00b4', '\u00f4'],
  ['\u00c3\u00b5', '\u00f5'],
  ['\u00c3\u00ba', '\u00fa'],
  ['\u00c3\u00a7', '\u00e7'],
  ['\u00c3\u2030', '\u00c9'],
  ['\u00c3\u0160', '\u00ca'],
  ['\u00c3\u201c', '\u00d3'],
  ['\u00c3\u201d', '\u00d4'],
  ['\u00c3\u0161', '\u00da'],
  ['\u00c3\u20ac', '\u00c0'],
  ['\u00c2\u00ba', '\u00ba'],
  ['\u00c2\u00aa', '\u00aa'],
  ['\u00e2\u20ac\u201c', '\u2013'],
  ['\u00e2\u20ac\u201d', '\u2014'],
  ['\u00e2\u20ac\u02dc', '\u2018'],
  ['\u00e2\u20ac\u2122', '\u2019'],
  ['\u00e2\u20ac\u0153', '\u201c'],
  ['\u00e2\u20ac\u009d', '\u201d'],
];

function aplicarSubstituicoesPlanilhaUtf8Legado(s) {
  if (s == null || s === '') return s;
  let t = s;
  for (const [from, to] of MOJIBAKE_PLANILHA_UTF8) {
    if (from && t.includes(from)) t = t.split(from).join(to);
  }
  return t.trim();
}

/** @param {unknown} s @returns {string} */
export function corrigirMojibakeUtf8(s) {
  if (s == null) return '';
  if (typeof s === 'number' && Number.isFinite(s)) s = String(s);
  else if (typeof s !== 'string') return '';
  if (s.length === 0) return s;
  let cur = s.normalize('NFC').trim();
  if (deveTentarReverterDuplaCamada(cur)) {
    for (let k = 0; k < 10; k++) {
      const apos = tentarUmaPassagemDuplaCodificacaoUtf8(cur);
      if (apos == null) break;
      cur = apos;
    }
  }
  let out = corrigirLatin1Utf8EmCadeia(cur);
  out = substituirClustersBlocoDesenhoU251c(out);
  out = corrigirLatin1Utf8EmCadeia(out);
  out = aplicarSubstituicoesPlanilhaUtf8Legado(out);
  return out.replace(/([A-ZÀ-ÖØ-Þ])ç([A-ZÀ-ÖØ-Þ])/g, '$1Ç$2');
}

/** Nome/razão social para exibição e persistência. */
export function corrigirNomePessoaExibicao(s) {
  return corrigirMojibakeUtf8(s);
}
