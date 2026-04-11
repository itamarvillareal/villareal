/**
 * Corpos JSON de exemplo para `POST …/{apiIndex}/_search` (laboratório / exploração).
 * O mapping real varia por tribunal; consultas podem falhar no ES com `nested` ou campo inexistente — trate como tentativa.
 *
 * Buscas por **nome** ou **CPF/CNPJ** na API pública podem estar vazias, limitadas ou indisponíveis (LGPD / política do índice).
 * @see https://datajud-wiki.cnj.jus.br/api-publica/glossario/
 */

import { DATAJUD_CAMPO } from './datajudGlossario.js';
import { cnjParaNumeroUnicoVinteDigitos } from './publicacoesCnjTribunal.js';

/** Campos candidatos a texto de parte (multi_match) — ajustar conforme glossário / mapping do tribunal. */
export const DATAJUD_LAB_CAMPOS_NOME_PARTE = Object.freeze([
  'partes.nome',
  'partes.pessoa.nome',
  'partes.nomeCompleto',
  'poloAtivo.nome',
  'poloPassivo.nome',
]);

/** Campos candidatos a documento (match) — tentativa; nem todos existem em todos os índices. */
export const DATAJUD_LAB_CAMPOS_DOCUMENTO_MATCH = Object.freeze([
  'partes.cpf',
  'partes.cnpj',
  'partes.numeroDocumento',
  'partes.documentoPrincipal',
  'partes.pessoa.cpf',
  'partes.pessoa.cnpj',
]);

function optsSizeTrack(opts = {}) {
  const out = {};
  const size = opts.size;
  if (Number.isFinite(size) && size > 0) out.size = Math.min(size, 10000);
  if (opts.trackTotalHits === true) out.track_total_hits = true;
  return out;
}

/**
 * CNJ formatado e/ou número único de 20 dígitos (mesma ideia que `corpoPesquisaNumeroProcesso` no cliente, com `size` configurável).
 */
export function datajudLabCorpoNumeroProcesso(cnjOuN20, opts = {}) {
  const fmt = String(cnjOuN20 ?? '')
    .trim()
    .replace(/\u2212/g, '-')
    .toUpperCase();
  const digits = fmt.replace(/\D/g, '');
  const n20flat = cnjParaNumeroUnicoVinteDigitos(fmt) ?? (digits.length === 20 ? digits : null);
  const should = [
    { match: { [DATAJUD_CAMPO.numeroProcesso]: fmt } },
    { term: { [DATAJUD_CAMPO.numeroProcesso]: fmt } },
    { term: { [DATAJUD_CAMPO.numeroProcessoKeyword]: fmt } },
  ];
  if (n20flat) {
    should.push(
      { match: { [DATAJUD_CAMPO.numeroProcesso]: n20flat } },
      { term: { [DATAJUD_CAMPO.numeroProcesso]: n20flat } },
      { term: { [DATAJUD_CAMPO.numeroProcessoKeyword]: n20flat } },
      {
        query_string: {
          default_field: DATAJUD_CAMPO.numeroProcesso,
          query: n20flat,
          default_operator: 'AND',
        },
      },
    );
  }
  return {
    query: {
      bool: {
        should,
        minimum_should_match: 1,
      },
    },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

/** Apenas match no tutorial (20 dígitos) — exige string de 20 dígitos. */
export function datajudLabCorpoMatchNumeroUnicoVinte(n20, opts = {}) {
  const d = String(n20 ?? '').replace(/\D/g, '');
  if (d.length !== 20) return null;
  return {
    query: { match: { [DATAJUD_CAMPO.numeroProcesso]: d } },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

export function datajudLabCorpoQueryString(texto, camposOuDefaultField, opts = {}) {
  const q = String(texto ?? '').trim();
  if (!q) return null;
  const useFields = Array.isArray(camposOuDefaultField) && camposOuDefaultField.length > 0;
  const qs = useFields
    ? { query: q, fields: camposOuDefaultField, default_operator: opts.defaultOperator ?? 'AND' }
    : {
        query: q,
        default_field: camposOuDefaultField || DATAJUD_CAMPO.numeroProcesso,
        default_operator: opts.defaultOperator ?? 'AND',
      };
  return {
    query: { query_string: qs },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

export function datajudLabCorpoClasseEOrgao(codigoClasse, codigoOrgaoJulgador, opts = {}) {
  const body = {
    query: {
      bool: {
        must: [
          { match: { [DATAJUD_CAMPO.classeCodigo]: codigoClasse } },
          { match: { [DATAJUD_CAMPO.orgaoJulgadorCodigo]: codigoOrgaoJulgador } },
        ],
      },
    },
  };
  return {
    ...body,
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

export function datajudLabCorpoIntervaloDataAjuizamento(gte, lte, opts = {}) {
  const range = {};
  if (gte) range.gte = String(gte);
  if (lte) range.lte = String(lte);
  if (Object.keys(range).length === 0) return null;
  return {
    query: { range: { dataAjuizamento: range } },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

/** `nested` em `movimentos` — comum no glossário DataJud. */
export function datajudLabCorpoMovimentoCodigo(codigo, opts = {}) {
  const code = Number.isFinite(Number(codigo)) ? Number(codigo) : codigo;
  return {
    query: {
      nested: {
        path: 'movimentos',
        query: {
          bool: {
            should: [{ term: { 'movimentos.codigo': code } }, { match: { 'movimentos.codigo': code } }],
            minimum_should_match: 1,
          },
        },
      },
    },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

export function datajudLabCorpoAssuntoCodigo(codigo, opts = {}) {
  const code = Number.isFinite(Number(codigo)) ? Number(codigo) : codigo;
  return {
    query: {
      nested: {
        path: 'assuntos',
        query: {
          bool: {
            should: [{ term: { 'assuntos.codigo': code } }, { match: { 'assuntos.codigo': code } }],
            minimum_should_match: 1,
          },
        },
      },
    },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

export function datajudLabCorpoGrau(grau, opts = {}) {
  const g = String(grau ?? '').trim();
  if (!g) return null;
  return {
    query: { match: { grau: g } },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

export function datajudLabCorpoNivelSigilo(nivel, opts = {}) {
  if (nivel === '' || nivel == null) return null;
  const raw = String(nivel).trim();
  if (!raw) return null;
  const n = Number(raw);
  const numeric = /^\d+$/.test(raw) && Number.isFinite(n);
  return {
    query: numeric
      ? {
          bool: {
            should: [{ term: { nivelSigilo: n } }, { term: { sigilo: n } }],
            minimum_should_match: 1,
          },
        }
      : {
          bool: {
            should: [{ match: { nivelSigilo: raw } }, { match: { sigilo: raw } }],
            minimum_should_match: 1,
          },
        },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

export function datajudLabCorpoNomeParte(nome, opts = {}) {
  const q = String(nome ?? '').trim();
  if (!q) return null;
  const mm = {
    query: q,
    fields: [...DATAJUD_LAB_CAMPOS_NOME_PARTE],
    type: 'best_fields',
    operator: 'or',
  };
  if (opts.fuzziness !== false) mm.fuzziness = 'AUTO';
  return {
    query: { multi_match: mm },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

export function datajudLabCorpoDocumentoDigitos(apenasDigitos, opts = {}) {
  const d = String(apenasDigitos ?? '').replace(/\D/g, '');
  if (!d) return null;
  const should = DATAJUD_LAB_CAMPOS_DOCUMENTO_MATCH.map((field) => ({ match: { [field]: d } }));
  return {
    query: {
      bool: {
        should,
        minimum_should_match: 1,
      },
    },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

export function datajudLabCorpoMatchAll(opts = {}) {
  return {
    query: { match_all: {} },
    ...optsSizeTrack({ size: opts.size ?? 5, trackTotalHits: opts.trackTotalHits }),
  };
}

/** `term` só em `numeroProcesso.keyword` (valor: CNJ formatado ou 20 dígitos). */
export function datajudLabCorpoTermKeywordNumeroProcesso(cnjOuN20, opts = {}) {
  const fmt = String(cnjOuN20 ?? '')
    .trim()
    .replace(/\u2212/g, '-')
    .toUpperCase();
  const digits = fmt.replace(/\D/g, '');
  const n20flat = cnjParaNumeroUnicoVinteDigitos(fmt) ?? (digits.length === 20 ? digits : null);
  const valor = n20flat || fmt;
  if (!valor) return null;
  return {
    query: { term: { [DATAJUD_CAMPO.numeroProcessoKeyword]: valor } },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

/**
 * @param {'term'|'match'|'match_phrase'} tipo
 * @param {string} campo — caminho ES (ex.: `tribunal`, `classe.nome`)
 * @param {string} valor — texto; em `term`, valores só dígitos viram número
 */
export function datajudLabCorpoDslCampoValor(tipo, campo, valor, opts = {}) {
  const c = String(campo ?? '').trim();
  const vRaw = String(valor ?? '').trim();
  if (!c || !vRaw) return null;
  const t = String(tipo ?? 'match').toLowerCase();
  if (t === 'term') {
    let val = vRaw;
    if (/^-?\d+$/.test(vRaw)) val = Number(vRaw);
    return {
      query: { term: { [c]: val } },
      ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
    };
  }
  if (t === 'match_phrase') {
    return {
      query: { match_phrase: { [c]: vRaw } },
      ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
    };
  }
  return {
    query: { match: { [c]: vRaw } },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

/** multi_match com lista de campos (CSV) e tipo Elastic (ex.: best_fields, cross_fields). */
export function datajudLabCorpoMultiMatchCamposLivres(query, camposCsv, tipo, opts = {}) {
  const q = String(query ?? '').trim();
  const fields = String(camposCsv ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!q || fields.length === 0) return null;
  const mm = {
    query: q,
    fields,
    type: tipo && String(tipo).trim() ? String(tipo).trim() : 'best_fields',
  };
  if (opts.fuzziness !== false) mm.fuzziness = 'AUTO';
  return {
    query: { multi_match: mm },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

/** simple_query_string — tolerante a sintaxe; `camposCsv` vazio = todos os campos permitidos pelo índice (custo). */
export function datajudLabCorpoSimpleQueryString(query, camposCsv, opts = {}) {
  const q = String(query ?? '').trim();
  if (!q) return null;
  const fields = String(camposCsv ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const inner = {
    query: q,
    default_operator: opts.defaultOperator ?? 'AND',
  };
  if (fields.length) inner.fields = fields;
  return {
    query: { simple_query_string: inner },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

/** Range no campo interno de ordenação da wiki (Ex. 3 — `search_after`). */
export function datajudLabCorpoRangeTimestamp(gte, lte, opts = {}) {
  const range = {};
  if (gte) range.gte = String(gte);
  if (lte) range.lte = String(lte);
  if (Object.keys(range).length === 0) return null;
  return {
    query: { range: { [DATAJUD_CAMPO.timestamp]: range } },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

export function datajudLabCorpoRangeCampoGenerico(campo, bounds, opts = {}) {
  const c = String(campo ?? '').trim();
  if (!c) return null;
  const range = {};
  const { gte, lte, gt, lt } = bounds ?? {};
  if (gte != null && gte !== '') range.gte = String(gte);
  if (lte != null && lte !== '') range.lte = String(lte);
  if (gt != null && gt !== '') range.gt = String(gt);
  if (lt != null && lt !== '') range.lt = String(lt);
  if (Object.keys(range).length === 0) return null;
  return {
    query: { range: { [c]: range } },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

export function datajudLabCorpoExistsField(campo, opts = {}) {
  const c = String(campo ?? '').trim();
  if (!c) return null;
  return {
    query: { exists: { field: c } },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

/** Lista de `_id` de documentos (vírgula ou quebra de linha). */
export function datajudLabCorpoIds(idsTextoOuArray, opts = {}) {
  const arr = Array.isArray(idsTextoOuArray)
    ? idsTextoOuArray.map((s) => String(s).trim()).filter(Boolean)
    : String(idsTextoOuArray ?? '')
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
  if (arr.length === 0) return null;
  return {
    query: { ids: { values: arr } },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

export function datajudLabCorpoPrefix(campo, prefixo, opts = {}) {
  const c = String(campo ?? '').trim();
  const p = String(prefixo ?? '').trim();
  if (!c || !p) return null;
  return {
    query: { prefix: { [c]: p } },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

/** Padrão wildcard Elastic (ex.: `*0001`); uso moderado (desempenho). */
export function datajudLabCorpoWildcard(campo, padrao, opts = {}) {
  const c = String(campo ?? '').trim();
  const w = String(padrao ?? '').trim();
  if (!c || !w) return null;
  return {
    query: { wildcard: { [c]: w } },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

/** `terms` — match exacto de um entre vários valores (CSV). */
export function datajudLabCorpoTermsCampo(campo, valoresCsv, opts = {}) {
  const c = String(campo ?? '').trim();
  const vals = String(valoresCsv ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!c || vals.length === 0) return null;
  return {
    query: { terms: { [c]: vals } },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

/** bool.must: classe.codigo + intervalo de dataAjuizamento. */
export function datajudLabCorpoBoolMustClasseEIntervaloAjuizamento(codigoClasse, gte, lte, opts = {}) {
  const range = {};
  if (gte) range.gte = String(gte);
  if (lte) range.lte = String(lte);
  if (codigoClasse === '' || codigoClasse == null || Object.keys(range).length === 0) return null;
  return {
    query: {
      bool: {
        must: [
          { match: { [DATAJUD_CAMPO.classeCodigo]: codigoClasse } },
          { range: { dataAjuizamento: range } },
        ],
      },
    },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

/** Texto livre nos campos de movimento (nested). */
export function datajudLabCorpoNestedMovimentoTexto(texto, opts = {}) {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  return {
    query: {
      nested: {
        path: 'movimentos',
        query: {
          bool: {
            should: [
              { match: { 'movimentos.complemento': t } },
              { match: { 'movimentos.nome': t } },
              { match: { 'movimentos.descricao': t } },
            ],
            minimum_should_match: 1,
          },
        },
      },
    },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

/**
 * nested em `partes` — subcampo sem prefixo vira `partes.{sub}` (ex.: `nome` → `partes.nome`).
 */
export function datajudLabCorpoNestedPartesCampoTexto(subcampoParte, texto, opts = {}) {
  const t = String(texto ?? '').trim();
  const sub = String(subcampoParte ?? 'nome').trim();
  if (!t) return null;
  const field = sub.includes('.') ? sub : `partes.${sub}`;
  return {
    query: {
      nested: {
        path: 'partes',
        query: { match: { [field]: t } },
      },
    },
    ...optsSizeTrack({ size: opts.size ?? 20, trackTotalHits: opts.trackTotalHits }),
  };
}

/** Wiki Ex. 3 — base para `search_after`: mesmo `sort` em todas as páginas. */
export function datajudLabCorpoMatchAllComSortTimestampAsc(opts = {}) {
  return {
    ...datajudLabCorpoMatchAll(opts),
    sort: [{ [DATAJUD_CAMPO.timestamp]: { order: 'asc' } }],
  };
}

/**
 * Anexa `sort` por `@timestamp` ascendente a um corpo já existente (útil com `search_after`).
 * @param {object} corpo — `{ query, size?, … }`
 */
export function datajudLabAnexarSortTimestampAsc(corpo) {
  const base = corpo && typeof corpo === 'object' ? corpo : {};
  return {
    ...base,
    sort: [{ [DATAJUD_CAMPO.timestamp]: { order: 'asc' } }],
  };
}

/** Lista dos identificadores de modo (1.º arg. de `executar` no lab) — documentação / UI. */
export const DATAJUD_LAB_TIPOS_PESQUISA = Object.freeze([
  'numero_processo',
  'match_n20',
  'term_numero_keyword',
  'query_string',
  'simple_query_string',
  'multi_match_campos_livres',
  'dsl_campo_valor',
  'classe_orgao',
  'bool_classe_intervalo_ajuizamento',
  'range_ajuizamento',
  'range_timestamp',
  'range_campo_generico',
  'movimento_nested',
  'movimento_texto_nested',
  'assunto_nested',
  'nested_partes',
  'grau',
  'sigilo',
  'nome_parte',
  'documento',
  'terms_campo',
  'exists_field',
  'ids_documentos',
  'prefix',
  'wildcard',
  'match_all',
  'match_all_sort_timestamp',
  'json_livre',
]);
