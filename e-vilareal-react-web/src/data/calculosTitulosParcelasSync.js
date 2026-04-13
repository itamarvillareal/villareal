/**
 * Sincroniza `titulos[]` a partir de `parcelas[]` quando a grade de Títulos ficou vazia
 * (import SQL / planilha legada só preenchia parcelamento).
 */

export function linhaTituloVaziaCalculos() {
  return {
    dataVencimento: '',
    valorInicial: '',
    atualizacaoMonetaria: '',
    diasAtraso: '',
    juros: '',
    multa: '',
    honorarios: '',
    total: '',
    descricaoValor: '',
    datasEspeciais: null,
  };
}

/**
 * Copia data/valor da parcela `i` para o título `i` só onde o título ainda está vazio.
 * Preserva `titulos[i]` já preenchido (manual ou recálculo).
 * @param {Record<string, unknown>} rodada
 * @returns {Record<string, unknown>}
 */
export function enriquecerTitulosAPartirDeParcelasNaRodada(rodada) {
  if (!rodada || typeof rodada !== 'object') return rodada;
  const parcelas = Array.isArray(rodada.parcelas) ? rodada.parcelas : [];
  let titulos = Array.isArray(rodada.titulos)
    ? rodada.titulos.map((t) => ({ ...linhaTituloVaziaCalculos(), ...(t && typeof t === 'object' ? t : {}) }))
    : [];

  let changed = false;
  const maxI = Math.max(parcelas.length, titulos.length);
  for (let i = 0; i < maxI; i++) {
    const p = parcelas[i];
    if (!p || typeof p !== 'object') continue;
    const temParc =
      String(p.dataVencimento ?? '').trim() !== '' || String(p.valorParcela ?? '').trim() !== '';
    if (!temParc) continue;
    while (titulos.length <= i) {
      titulos.push(linhaTituloVaziaCalculos());
      changed = true;
    }
    const cur = { ...titulos[i] };
    let rowChanged = false;
    if (String(cur.valorInicial ?? '').trim() === '' && String(p.valorParcela ?? '').trim() !== '') {
      cur.valorInicial = p.valorParcela;
      rowChanged = true;
    }
    if (String(cur.dataVencimento ?? '').trim() === '' && String(p.dataVencimento ?? '').trim() !== '') {
      cur.dataVencimento = p.dataVencimento;
      rowChanged = true;
    }
    if (rowChanged) {
      titulos[i] = cur;
      changed = true;
    }
  }

  if (!changed) return rodada;
  return { ...rodada, titulos };
}

/**
 * @param {Record<string, unknown>} map — chaves `codigo8:proc:dim`
 */
export function enriquecerMapaRodadasTitulosDesdeParcelas(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return map;
  const out = { ...map };
  for (const k of Object.keys(out)) {
    const r = out[k];
    if (r && typeof r === 'object') {
      out[k] = enriquecerTitulosAPartirDeParcelasNaRodada(r);
    }
  }
  return out;
}

/** Garante chave `00000922:3:0` (8 dígitos no cliente), alinhado a {@link RodadaCalculoChave} no Java. */
export function normalizarChaveRodadaCalculos(key) {
  const parts = String(key ?? '').split(':');
  if (parts.length !== 3) return String(key);
  const codRaw = String(parts[0] ?? '').replace(/\D/g, '');
  const n = Number(codRaw || '0');
  if (!Number.isFinite(n) || n < 1) return String(key);
  const cod8 = String(Math.floor(n)).padStart(8, '0');
  const proc = Math.max(1, Math.floor(Number(parts[1]) || 1));
  const dim = Math.max(0, Math.floor(Number(parts[2]) || 0));
  return `${cod8}:${proc}:${dim}`;
}

/**
 * Reescreve chaves do mapa com padding 8; em colisão (ex.: `922:1:0` e `00000922:1:0`) mantém a última entrada.
 */
export function normalizarMapaChavesRodadasCalculos(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return map;
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    const nk = normalizarChaveRodadaCalculos(k);
    out[nk] = v;
  }
  return out;
}
