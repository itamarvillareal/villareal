/**
 * Patrimônio pessoal do master (Itamar): imóveis, veículos e aplicações financeiras.
 * Persistência local (localStorage). Dado privado — só aparece na estação master.
 */

const STORAGE_KEY = 'vilareal:patrimonio:v1';
/** Imóveis sugeridos que o usuário rejeitou — só voltam ao pedir atualização de sugestões. */
const STORAGE_IGNORADOS_KEY = 'vilareal:patrimonio:imoveis-ignorados:v1';

export const CATEGORIAS_PATRIMONIO = ['imoveis', 'veiculos', 'aplicacoes'];

function estadoVazio() {
  return { imoveis: [], veiculos: [], aplicacoes: [] };
}

export function loadPatrimonio() {
  if (typeof window === 'undefined') return estadoVazio();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return estadoVazio();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return estadoVazio();
    return {
      imoveis: Array.isArray(parsed.imoveis) ? parsed.imoveis : [],
      veiculos: Array.isArray(parsed.veiculos) ? parsed.veiculos : [],
      aplicacoes: Array.isArray(parsed.aplicacoes) ? parsed.aplicacoes : [],
    };
  } catch {
    return estadoVazio();
  }
}

export function savePatrimonio(estado) {
  if (typeof window === 'undefined') return;
  try {
    const limpo = {
      imoveis: Array.isArray(estado?.imoveis) ? estado.imoveis : [],
      veiculos: Array.isArray(estado?.veiculos) ? estado.veiculos : [],
      aplicacoes: Array.isArray(estado?.aplicacoes) ? estado.aplicacoes : [],
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(limpo));
    window.dispatchEvent(new CustomEvent('vilareal:patrimonio-atualizado'));
  } catch {
    /* quota */
  }
}

export function gerarIdPatrimonio() {
  return `pat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Ids (origemImovelId) das sugestões de imóvel rejeitadas. */
export function loadImoveisSugestaoIgnorados() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_IGNORADOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveImoveisSugestaoIgnorados(ids) {
  if (typeof window === 'undefined') return;
  try {
    const lista = Array.isArray(ids) ? ids.filter((v) => v != null) : [];
    window.localStorage.setItem(STORAGE_IGNORADOS_KEY, JSON.stringify(lista));
  } catch {
    /* quota */
  }
}
