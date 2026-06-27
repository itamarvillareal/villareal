import { parseValorMonetarioBr } from './parseValorMonetarioBr.js';

/**
 * Converte texto monetário pt-BR (como em Cálculos) para centavos inteiros.
 * Aceita "R$ 1.493,49", "1493,49", etc.
 */
export function parseBRLToCentavos(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  const cleaned = s.replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Exibição com símbolo R$ (aceita API «1605.6» e planilha «1.605,60»). */
export function formatValorMoeda(val) {
  const s = String(val ?? '').trim();
  if (!s) return '—';
  const n = parseValorMonetarioBr(val);
  if (n != null && Number.isFinite(n)) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return s.startsWith('R$') ? s : `R$ ${s}`;
}

/** Campo de formulário: 1605.6 → «1.605,60». */
export function formatValorMoedaCampo(val) {
  const n = parseValorMonetarioBr(val);
  if (n == null || !Number.isFinite(n)) return String(val ?? '').trim();
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Normaliza entrada monetária no formulário enquanto digita ou ao sair do campo.
 * @param {string} texto
 * @param {{ finalizar?: boolean }} [opts] — `finalizar: true` no blur (ex.: «17» → «17,00»).
 */
export function editarMoedaCampo(texto, { finalizar = false } = {}) {
  const raw = String(texto ?? '');
  if (!raw.trim()) return '';

  const semEspacos = raw.replace(/\u00a0/g, ' ').trim();

  if (finalizar) {
    const n = parseValorMonetarioBr(semEspacos);
    return n != null ? formatValorMoedaCampo(n) : semEspacos;
  }

  const semSimbolo = semEspacos.replace(/R\$/gi, '').trim();
  if (!semSimbolo) return '';

  // Vírgula explícita: centavos parciais (ex.: «17,5»), sem forçar «,00» enquanto digita.
  if (semSimbolo.includes(',')) {
    const [parteInteira = '', parteDecimal = ''] = semSimbolo.replace(/\./g, '').split(',');
    const intDigitos = parteInteira.replace(/\D/g, '');
    const decDigitos = parteDecimal.replace(/\D/g, '').slice(0, 2);
    const intFmt = intDigitos ? Number(intDigitos).toLocaleString('pt-BR') : '';
    if (semSimbolo.endsWith(',')) {
      return intFmt ? `${intFmt},` : ',';
    }
    return decDigitos.length > 0 ? `${intFmt || '0'},${decDigitos}` : `${intFmt},`;
  }

  // Parte inteira: milhar progressivo, sem «,00» até o blur.
  const digitos = semSimbolo.replace(/\D/g, '');
  if (!digitos) return '';
  const normalizado = digitos.replace(/^0+(?=\d)/, '');
  return Number(normalizado).toLocaleString('pt-BR');
}

/** Reposiciona o cursor após inserir separadores de milhar. */
export function calcularPosicaoCursorMoedaBr(textoAntes, posicaoCursor, textoDepois) {
  const alvo = String(textoAntes ?? '')
    .slice(0, posicaoCursor ?? 0)
    .replace(/\D/g, '').length;
  if (alvo <= 0) return 0;
  let digitos = 0;
  const depois = String(textoDepois ?? '');
  for (let i = 0; i < depois.length; i++) {
    if (/\d/.test(depois[i])) {
      digitos++;
      if (digitos === alvo) return i + 1;
    }
  }
  return depois.length;
}
