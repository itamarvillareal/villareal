/**
 * Presets nomeados do Relatório Processos (colunas visíveis, largura uniforme, campo da coluna dinâmica).
 */
import { normalizarCampoColunaDinamica } from './relatorioProcessosColunaDinamica.js';

const STORAGE_PRESETS = 'vilareal.relatorioProcessos.presets.v1';
const MAX_PRESETS = 50;

/** @typedef {'todos' | 'ativos' | 'inativos'} FiltroProcessoAtivoRelatorio */

/**
 * @typedef {{
 *   colunasVisiveis: Record<string, boolean>,
 *   larguraUniforme: boolean,
 *   campoPorColuna: Record<string, string>,
 *   filtroProcessoAtivo: FiltroProcessoAtivoRelatorio,
 *   modoAlteracao: boolean,
 * }} RelatorioPresetConfig
 * @typedef {{ id: string, nome: string, criadoEm: string, atualizadoEm?: string, config: RelatorioPresetConfig }} RelatorioPreset
 */

/** Exibir processos: todos, só ativos ou só inativos (cadastro Processos). Padrão: só ativos. */
export function normalizarFiltroProcessoAtivo(val) {
  const v = String(val ?? '').trim();
  if (v === 'ativos' || v === 'inativos' || v === 'todos') return v;
  return 'ativos';
}

export function mesclarColunasVisiveisPreset(colIds, salvo) {
  const next = {};
  for (const id of colIds) {
    if (salvo && Object.prototype.hasOwnProperty.call(salvo, id)) {
      next[id] = salvo[id] !== false;
    } else {
      next[id] = true;
    }
  }
  return next;
}

/**
 * Snapshot apenas com ids conhecidos da grade (evita lixo no JSON).
 */
export function criarSnapshotConfiguracaoRelatorio(
  { colunasVisiveis, larguraUniforme, campoPorColuna, filtroProcessoAtivo, modoAlteracao },
  colIds
) {
  const v = {};
  for (const id of colIds) {
    v[id] = colunasVisiveis[id] !== false;
  }
  const campos = {};
  for (const id of colIds) {
    if (campoPorColuna && campoPorColuna[id] != null) {
      campos[id] = normalizarCampoColunaDinamica(campoPorColuna[id]);
    } else {
      campos[id] = id;
    }
  }
  return {
    colunasVisiveis: v,
    larguraUniforme: !!larguraUniforme,
    campoPorColuna: campos,
    filtroProcessoAtivo: normalizarFiltroProcessoAtivo(filtroProcessoAtivo),
    modoAlteracao: !!modoAlteracao,
  };
}

/** Configuração inicial: todas as colunas, sem largura uniforme, coluna dinâmica padrão. */
export function configRelatorioPadrao(colIds) {
  return {
    colunasVisiveis: Object.fromEntries(colIds.map((id) => [id, true])),
    larguraUniforme: false,
    campoPorColuna: Object.fromEntries(colIds.map((id) => [id, id])),
    filtroProcessoAtivo: 'ativos',
    modoAlteracao: false,
  };
}

export function carregarPresetsRelatorio() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PRESETS);
    if (!raw) return [];
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    return p
      .filter((x) => x && typeof x === 'object' && typeof x.id === 'string' && typeof x.nome === 'string' && x.config)
      .slice(0, MAX_PRESETS);
  } catch {
    return [];
  }
}

function persistirPresets(lista) {
  try {
    window.localStorage.setItem(STORAGE_PRESETS, JSON.stringify(lista.slice(0, MAX_PRESETS)));
  } catch {
    /* ignore */
  }
}

/**
 * @returns {{ ok: true, preset: RelatorioPreset } | { ok: false, mensagem: string }}
 */
export function salvarNovoPresetRelatorio(nome, snapshot, colIds) {
  const nomeTrim = String(nome ?? '').trim();
  if (!nomeTrim) return { ok: false, mensagem: 'Informe um nome para a configuração.' };
  const lista = carregarPresetsRelatorio();
  if (lista.length >= MAX_PRESETS) {
    return { ok: false, mensagem: `É possível guardar no máximo ${MAX_PRESETS} configurações.` };
  }
  const config = criarSnapshotConfiguracaoRelatorio(snapshot, colIds);
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `preset-${Date.now()}`;
  const agora = new Date().toISOString();
  /** @type {RelatorioPreset} */
  const novo = {
    id,
    nome: nomeTrim.slice(0, 100),
    criadoEm: agora,
    atualizadoEm: agora,
    config,
  };
  persistirPresets([novo, ...lista]);
  return { ok: true, preset: novo };
}

export function excluirPresetRelatorio(id) {
  const lista = carregarPresetsRelatorio().filter((p) => p.id !== id);
  persistirPresets(lista);
}

/**
 * @returns {RelatorioPresetConfig | null}
 */
export function aplicarPresetRelatorio(preset, colIds) {
  if (!preset?.config) return null;
  const c = preset.config;
  const baseCampo = Object.fromEntries(colIds.map((id) => [id, id]));
  if (c.campoPorColuna && typeof c.campoPorColuna === 'object') {
    for (const id of colIds) {
      if (c.campoPorColuna[id] != null) baseCampo[id] = normalizarCampoColunaDinamica(c.campoPorColuna[id]);
    }
  } else if (c.campoUltimoAndamento != null) {
    baseCampo.ultimoAndamento = normalizarCampoColunaDinamica(c.campoUltimoAndamento);
  }
  return {
    colunasVisiveis: mesclarColunasVisiveisPreset(colIds, c.colunasVisiveis),
    larguraUniforme: !!c.larguraUniforme,
    campoPorColuna: baseCampo,
    filtroProcessoAtivo: normalizarFiltroProcessoAtivo(c.filtroProcessoAtivo),
    modoAlteracao: !!c.modoAlteracao,
  };
}
