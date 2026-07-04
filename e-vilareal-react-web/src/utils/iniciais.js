/**
 * Iniciais a partir de um nome de pessoa.
 * Uma palavra → 2 primeiras letras; duas ou mais → primeira + última palavra; vazio → '?'.
 *
 * @param {string|undefined|null} nome
 * @returns {string}
 */
export function iniciaisNome(nome) {
  const parts = String(nome ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Iniciais para exibição em avatar de contato (nome ou telefone como fallback).
 *
 * @param {string|undefined|null} nome
 * @param {string|undefined|null} telefone
 * @returns {string}
 */
export function iniciaisContato(nome, telefone) {
  if (String(nome ?? '').trim()) {
    return iniciaisNome(nome);
  }
  const digits = String(telefone ?? '').replace(/\D/g, '');
  if (digits.length >= 2) {
    return digits.slice(-2);
  }
  return '?';
}
