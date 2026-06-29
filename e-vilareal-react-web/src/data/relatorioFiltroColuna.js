/** Modos de filtro por coluna nos relatórios tabulares. */
export const MODOS_FILTRO_COLUNA = {
  contem: 'contem',
  vazios: 'vazios',
  preenchidos: 'preenchidos',
};

export const OPCOES_MODO_FILTRO_COLUNA = [
  { value: MODOS_FILTRO_COLUNA.contem, label: 'Contém' },
  { value: MODOS_FILTRO_COLUNA.vazios, label: 'Vazios' },
  { value: MODOS_FILTRO_COLUNA.preenchidos, label: 'Com valor' },
];

/** Valor considerado vazio para filtro (célula em branco ou placeholder «—»). */
export function valorCelulaRelatorioVazia(valor) {
  const t = String(valor ?? '').trim();
  if (!t) return true;
  return t === '—' || t === '-' || t === '–';
}

/**
 * @param {unknown} valor
 * @param {string} filtroTexto
 * @param {'contem'|'vazios'|'preenchidos'|string} [modo]
 */
export function linhaPassaFiltroColunaRelatorio(valor, filtroTexto, modo = MODOS_FILTRO_COLUNA.contem) {
  const m = modo === MODOS_FILTRO_COLUNA.vazios || modo === MODOS_FILTRO_COLUNA.preenchidos
    ? modo
    : MODOS_FILTRO_COLUNA.contem;
  const vazio = valorCelulaRelatorioVazia(valor);

  if (m === MODOS_FILTRO_COLUNA.vazios) return vazio;
  if (m === MODOS_FILTRO_COLUNA.preenchidos) return !vazio;

  const filtro = String(filtroTexto ?? '').trim().toLowerCase();
  if (!filtro) return true;
  if (filtro === 'vazio' || filtro === 'vazios' || filtro === '(vazio)') return vazio;
  return String(valor ?? '').toLowerCase().includes(filtro);
}
