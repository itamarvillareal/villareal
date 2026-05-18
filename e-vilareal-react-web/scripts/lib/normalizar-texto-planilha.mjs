/**
 * Corrige mojibake típico de planilhas legadas (UTF-8 lido como Latin-1 / Windows-1252).
 * Alinhado à agenda (`import-agenda-planilha.mjs`); reutilizar em todos os imports .xls/.xlsx.
 *
 * @param {unknown} val
 * @returns {string} texto normalizado ou string vazia
 */
export function normalizarTextoPlanilha(val) {
  let s = String(val ?? '').normalize('NFC').trim();
  if (!s) return '';
  /** Ordem relevante (ex.: tratar Ã‡ antes de remover Â residual). */
  const trocas = [
    ['Ã‡', 'Ç'],
    ['Ãƒ', 'Ã'],
    ['Ã¡', 'á'],
    ['Ã¢', 'â'],
    ['Ã£', 'ã'],
    ['Ã©', 'é'],
    ['Ãª', 'ê'],
    ['Ã­', 'í'],
    ['Ã³', 'ó'],
    ['Ã´', 'ô'],
    ['Ãµ', 'õ'],
    ['Ãº', 'ú'],
    ['Ã§', 'ç'],
    ['Ã‰', 'É'],
    ['ÃŠ', 'Ê'],
    ['Ã“', 'Ó'],
    ['Ã”', 'Ô'],
    ['Ãš', 'Ú'],
    ['Ã€', 'À'],
    ['Âº', 'º'],
    ['Âª', 'ª'],
    ['â€“', '–'],
    ['â€”', '—'],
    ['â€˜', '‘'],
    ['â€™', '’'],
    ['â€œ', '“'],
    ['â€\u009d', '”'],
    /* Não remover «Â» isolado — destrói nomes válidos (ex.: CÂMARA). Use só pares Âº/Âª acima. */
  ];
  for (const [from, to] of trocas) {
    if (s.includes(from)) {
      s = s.split(from).join(to);
    }
  }
  return s.trim();
}
