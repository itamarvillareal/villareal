const PALAVRAS_JURIDICAS = new Set([
  'BRASILEIRO',
  'BRASILEIRA',
  'CASADO',
  'CASADA',
  'SOLTEIRO',
  'SOLTEIRA',
  'DIVORCIADO',
  'DIVORCIADA',
  'VIUVO',
  'VIUVA',
  'EMPRESARIO',
  'EMPRESÁRIA',
  'PORTADOR',
  'PORTADORA',
  'INSCRITO',
  'INSCRITA',
  'RESIDENTE',
  'DOMICILIADO',
  'DOMICILIADA',
  'AVENIDA',
  'RUA',
  'BAIRRO',
  'CEP',
  'ENDERECO',
  'ENDEREÇO',
  'CLIENTE',
  'AUTOR',
  'REU',
  'RÉU',
  'PARTE',
]);

/**
 * @param {string} nome
 * @param {{ posicaoInicio?: number, proximoACpfOuRg?: boolean }} contexto
 */
export function scorePossiblePersonName(nome, contexto = {}) {
  if (!nome || typeof nome !== 'string') return 0;
  const s = nome.replace(/\s+/g, ' ').trim();
  if (s.length < 5) return 0;
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return 0.15;

  let score = 0.35;
  score += Math.min(0.35, tokens.length * 0.08);
  const digitos = (s.match(/\d/g) || []).length;
  if (digitos > 0) score -= 0.25;

  const upper = s.toUpperCase();
  let penal = 0;
  for (const p of PALAVRAS_JURIDICAS) {
    if (upper.includes(p)) penal += 0.12;
  }
  score -= Math.min(0.5, penal);

  if (contexto.posicaoInicio != null && contexto.posicaoInicio < 80) score += 0.15;
  if (contexto.proximoACpfOuRg) score += 0.08;
  if (/^[A-ZÀ-Ú][A-ZÀ-Ú\s']+$/.test(s) && tokens.length >= 3) score += 0.12;

  return Math.max(0, Math.min(0.98, score));
}
