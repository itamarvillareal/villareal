/**
 * Limpeza adicional de texto de e-mails Gmail/Jusbrasil embutidos no PDF.
 * Independente de `publicacoesPdfParser` (evita import circular).
 */

function normalizarTextoPdfLocal(texto) {
  let t = String(texto ?? '');
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(/[\u00AD\u200B\uFEFF]/g, '');
  t = t.replace(/[–—]/g, '-');
  t = t.replace(/ +/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

function removerRuidoCabecalhoRodapeLocal(texto) {
  const linhas = String(texto).split('\n');
  const out = [];
  for (const raw of linhas) {
    const L = raw.trim();
    if (!L) {
      out.push('');
      continue;
    }
    if (/^p[áa]gina\s+\d+/i.test(L)) continue;
    if (/^gmail\s*$/i.test(L)) continue;
    if (/^mostrar mensagem original/i.test(L)) continue;
    if (/^on\s+.+\s+wrote:/i.test(L)) continue;
    out.push(raw);
  }
  return out.join('\n');
}

/** Junta letras partidas por quebra (ex.: "NÚ ME RO" → "NÚMERO") — conservador. */
function colapsarQuebrasInternasPalavras(texto) {
  return String(texto ?? '')
    .replace(/N[ÚU]\s+M[EÊ]\s+R[O0]\s+[ÚU]N[IÍ]C[O0]/gi, 'NÚMERO ÚNICO')
    .replace(/P\s*u\s*b\s*l\s*i\s*c\s*a\s*[çc]\s*[aã]\s*o/gi, 'Publicação');
}

/**
 * Remove ruídos típicos do Jusbrasil/Gmail no corpo convertido para texto.
 */
export function limparRuidoJusbrasilGmail(texto) {
  let t = colapsarQuebrasInternasPalavras(texto);
  t = removerRuidoCabecalhoRodapeLocal(normalizarTextoPdfLocal(t));
  const linhas = t.split('\n');
  const out = [];
  for (const raw of linhas) {
    const L = raw.trim();
    if (!L) {
      out.push('');
      continue;
    }
    if (/^https?:\/\//i.test(L)) continue;
    if (/mail\.google\.com/i.test(L)) continue;
    if (/jusbrasil\.com\.br/i.test(L) && L.length < 120) continue;
    if (/analisar\s+publica[çc][aã]o\s+no\s+jus\s*ia/i.test(L)) continue;
    if (/^acessar\s+publica[çc][aã]o/i.test(L)) continue;
    if (/voc[eê]\s+conseguiu\s+localizar\s+sua\s+publica[çc][aã]o/i.test(L)) continue;
    if (/^\s*(sim|n[aã]o)\s*$/i.test(L) && out.length > 0 && /localizar sua publica/i.test(out[out.length - 1] || '')) {
      continue;
    }
    if (/^\d+\s*\/\s*\d+\s*$/.test(L)) continue;
    if (/^\d{1,2}:\d{2}\s*(AM|PM)?\s*$/i.test(L)) continue;
    out.push(raw);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function prepararTextoParaSegmentacao(textoBruto) {
  return limparRuidoJusbrasilGmail(textoBruto);
}
