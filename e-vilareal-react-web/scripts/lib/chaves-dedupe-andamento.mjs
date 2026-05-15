/**
 * Chaves de deduplicação de `processo_andamento` — alinhadas a `import-historico-planilha.mjs` (--apenas-novos).
 *
 * Regra de escopo: comparações só fazem sentido **dentro do mesmo `processo_id`** (e portanto do mesmo
 * cliente + número interno). Funções abaixo definem a parte “conteúdo”; o script principal prefixa
 * `proc:{id}|` para impedir agrupamento entre processos distintos.
 */
import { normalizarTextoPlanilha } from './normalizar-texto-planilha.mjs';

/**
 * Garante que todos os andamentos pertencem ao processo esperado (nunca cruzar processos).
 * @param {{ id: number, processo_id: number }[]} rows
 * @param {number} processoIdEsperado
 */
export function assertMesmoProcessoId(rows, processoIdEsperado) {
  const esperado = Number(processoIdEsperado);
  for (const r of rows) {
    if (Number(r.processo_id) !== esperado) {
      throw new Error(
        `Violação de escopo: andamento #${r.id} está no processo ${r.processo_id}, esperado ${esperado}. ` +
          'Duplicados só podem ser avaliados dentro do mesmo processo.'
      );
    }
  }
}

/**
 * Chave de bucket: processo + conteúdo (impossibilita misturar processos no mesmo grupo).
 * @param {number} processoId
 * @param {string} chaveConteudo
 */
export function chaveBucketPorProcesso(processoId, chaveConteudo) {
  return `proc:${Number(processoId)}|${chaveConteudo}`;
}

/** Título alinhado ao POST (trim + mojibake + maiúsculas + espaços). */
export function chaveTituloParaDedupe(titulo) {
  const u = normalizarTextoPlanilha(String(titulo ?? ''))
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  const base = u || 'ANDAMENTO';
  return base.length > 500 ? base.slice(0, 500) : base;
}

/**
 * Normaliza valor MySQL/ISO para comparação (segundos UTC).
 * @param {unknown} movimentoEm
 */
export function chaveMovimentoEmParaDedupe(movimentoEm) {
  if (movimentoEm == null || movimentoEm === '') return '_null_';
  if (movimentoEm instanceof Date) {
    if (Number.isNaN(movimentoEm.getTime())) return '_invalid_';
    return movimentoEm.toISOString().slice(0, 19) + 'Z';
  }
  const s = String(movimentoEm).trim();
  if (!s) return '_null_';
  const d = new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return s.slice(0, 48);
  return d.toISOString().slice(0, 19) + 'Z';
}

/** Apenas a parte da data (YYYY-MM-DD) em UTC — camada “data do dia”. */
export function chaveDataDiaUtc(movimentoEm) {
  const k = chaveMovimentoEmParaDedupe(movimentoEm);
  if (k === '_null_' || k === '_invalid_') return k;
  return k.slice(0, 10);
}

/** @param {unknown} movimentoEm @param {unknown} titulo */
export function chaveAndamentoEstrita(movimentoEm, titulo) {
  return `${chaveMovimentoEmParaDedupe(movimentoEm)}|${chaveTituloParaDedupe(titulo)}`;
}

/** @param {unknown} movimentoEm @param {unknown} titulo */
export function chaveAndamentoPorDataDia(titulo, movimentoEm) {
  return `${chaveDataDiaUtc(movimentoEm)}|${chaveTituloParaDedupe(titulo)}`;
}

/** Comparação byte-a-byte do título e do instante tal como na BD (camada conservadora extra). */
export function chaveAndamentoBruta(movimentoEm, titulo) {
  const tit = String(titulo ?? '');
  const mov =
    movimentoEm instanceof Date
      ? movimentoEm.toISOString()
      : movimentoEm == null
        ? ''
        : String(movimentoEm);
  return `${mov}\0${tit}`;
}

/** Detalhe normalizado para exigir igualdade entre duplicados. */
export function chaveDetalheParaDedupe(detalhe) {
  if (detalhe == null || detalhe === '') return '';
  return normalizarTextoPlanilha(detalhe).trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Origens geradas pelo import de histórico (`import-historico-planilha.mjs`). */
export function isOrigemImportPlanilha(origem) {
  const o = String(origem ?? '').trim();
  return o === 'IMPORT_PLANILHA' || /^IMPORT_PLANILHA_[A-Z0-9_]+$/.test(o);
}

/**
 * Prioridade ao escolher qual linha manter quando há duplicata entre rodadas de import.
 * Preferência: IMPORT_PLANILHA (lote principal) > IMPORT_PLANILHA_* (faixas) > outras origens.
 * @param {string} origem
 */
export function prioridadeOrigemImport(origem) {
  const o = String(origem ?? '').trim();
  if (o === 'IMPORT_PLANILHA') return 100;
  if (/^IMPORT_PLANILHA_[A-Z0-9_]+$/.test(o)) return 85;
  if (isOrigemImportPlanilha(o)) return 80;
  return 10;
}

/**
 * Classifica duplicata típica de reimportação com `--origem=IMPORT_PLANILHA_*` sem limpar a origem anterior.
 * @param {{ origem: string }[]} rows
 */
export function classificarMotivoDuplicado(rows) {
  const origens = [...new Set(rows.map((r) => String(r.origem ?? '').trim()).filter(Boolean))];
  const imports = origens.filter(isOrigemImportPlanilha);
  if (origens.length > 1 && imports.length >= 2) {
    return {
      motivo: 'REIMPORTACAO_ENTRE_ORIGENS',
      descricao:
        'Mesmo movimento importado em rodadas distintas (ex.: IMPORT_PLANILHA e IMPORT_PLANILHA_376_499). A coluna origem não entra na chave de duplicata.',
      origens,
    };
  }
  if (origens.length > 1) {
    return {
      motivo: 'CONTEUDO_IGUAL_ORIGENS_DIFERENTES',
      descricao: 'Mesmo conteúdo com valores distintos em `origem`.',
      origens,
    };
  }
  return {
    motivo: 'REIMPORTACAO_MESMA_ORIGEM',
    descricao: 'Linhas repetidas na mesma origem (POST duplicado ou import sem --apenas-novos).',
    origens,
  };
}

/**
 * Pontuação do registo a manter (maior = preferido).
 * @param {{ id: number, usuario_id: number | null, detalhe: string | null, origem: string, prazo_refs: number, importacao_id?: string | null }} row
 */
export function pontuarCandidatoKeeper(row) {
  let p = 0;
  if (row.prazo_refs > 0) p += 1000;
  if (row.usuario_id != null) p += 50;
  if (row.detalhe != null && String(row.detalhe).trim() !== '') p += 20;
  p += prioridadeOrigemImport(row.origem);
  if (row.importacao_id) p += 5;
  // id menor = inserido primeiro (estável entre reimportações)
  p += Math.max(0, 1_000_000 - Number(row.id)) / 1_000_000;
  return p;
}

/**
 * Distância de Levenshtein normalizada (0 = igual, 1 = totalmente diferente).
 * @param {string} a
 * @param {string} b
 */
export function distanciaTituloNormalizada(a, b) {
  const x = chaveTituloParaDedupe(a);
  const y = chaveTituloParaDedupe(b);
  if (x === y) return 0;
  const maxLen = Math.max(x.length, y.length, 1);
  return levenshtein(x, y) / maxLen;
}

/** @param {string} a @param {string} b */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  /** @type {number[]} */
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    /** @type {number[]} */
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}
