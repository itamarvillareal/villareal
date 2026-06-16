/**
 * Corrige partes importadas com polo invertido quando `papel_cliente=REQUERIDO`.
 * O import legado mapeava 90→AUTOR e 95→REU; para REQUERIDO o correto é 90→REU e 95→AUTOR.
 */

import {
  POLO_PROCESSO_PARTE_CLIENTE,
  POLO_PROCESSO_PARTE_OPOSTA,
} from './legado-pessoa-cliente-vs-partes-processo.mjs';
import {
  assinaturaParteApi,
  lerPartesProcessoTxt,
  parteTxtParaApiBody,
} from './proc-processo-partes-txt.mjs';
import {
  defaultBaseProcMil,
  levantarCamposSemanticosProcesso,
} from './proc-processo-semantic-txt.mjs';
import {
  listarPartes,
} from './proc-processo-partes-api.mjs';

export const ORIGEM_CORRECAO_REQUERIDO = 'corrigir-partes-requerido-txt';

/**
 * @param {string | null | undefined} polo
 */
export function normalizarPoloApi(polo) {
  return String(polo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * @param {object} parteApi
 * @param {ReturnType<typeof parteTxtParaApiBody>} body
 */
function parteApiCorrespondeBody(parteApi, body) {
  return assinaturaParteApi(parteApi, null) === assinaturaParteApi(null, body);
}

/**
 * @param {object[]} partesApi
 * @param {number} pessoaId
 * @param {number} ordem
 * @param {string} poloNorm
 */
function buscarParteApiPorPessoaOrdemPolo(partesApi, pessoaId, ordem, poloNorm) {
  const pid = Number(pessoaId);
  const o = Number(ordem);
  for (const p of partesApi || []) {
    if (Number(p.pessoaId) !== pid) continue;
    if (Number(p.ordem ?? 0) !== o) continue;
    if (normalizarPoloApi(p.polo) !== poloNorm) continue;
    return p;
  }
  return null;
}

/**
 * @typedef {'ok' | 'inverter' | 'criar' | 'duplicado'} CorrecaoParteRequeridoTipo
 * @typedef {object} CorrecaoParteRequerido
 * @property {CorrecaoParteRequeridoTipo} tipo
 * @property {import('./proc-processo-partes-txt.mjs').ParteProcessoTxt} pt
 * @property {ReturnType<typeof parteTxtParaApiBody>} bodyEsperado
 * @property {string} poloErrado
 * @property {string} poloEsperado
 * @property {number | null} [parteIdPut]
 * @property {number | null} [parteIdDelete]
 */

/**
 * @param {import('./proc-processo-partes-txt.mjs').ParteProcessoTxt[]} partesTxt
 * @param {object[]} partesApi
 * @returns {{ correcoes: CorrecaoParteRequerido[], ok: number }}
 */
export function analisarCorrecoesPartesRequerido(partesTxt, partesApi) {
  /** @type {CorrecaoParteRequerido[]} */
  const correcoes = [];
  let ok = 0;

  for (const pt of partesTxt || []) {
    if (pt.pessoaId == null) continue;

    const bodyEsperado = parteTxtParaApiBody(pt, 'REQUERIDO');
    const bodyLegadoErrado = parteTxtParaApiBody(pt, 'REQUERENTE');
    const poloEsperado = normalizarPoloApi(bodyEsperado.polo);
    const poloErrado = normalizarPoloApi(bodyLegadoErrado.polo);

    const noPoloEsperado = buscarParteApiPorPessoaOrdemPolo(
      partesApi,
      pt.pessoaId,
      bodyEsperado.ordem,
      poloEsperado
    );
    const noPoloErrado = buscarParteApiPorPessoaOrdemPolo(
      partesApi,
      pt.pessoaId,
      bodyLegadoErrado.ordem,
      poloErrado
    );

    if (noPoloEsperado && parteApiCorrespondeBody(noPoloEsperado, bodyEsperado)) {
      if (noPoloErrado && noPoloErrado.id !== noPoloEsperado.id) {
        correcoes.push({
          tipo: 'duplicado',
          pt,
          bodyEsperado,
          poloErrado,
          poloEsperado,
          parteIdPut: null,
          parteIdDelete: Number(noPoloErrado.id),
        });
      } else {
        ok += 1;
      }
      continue;
    }

    if (noPoloErrado) {
      correcoes.push({
        tipo: noPoloEsperado ? 'duplicado' : 'inverter',
        pt,
        bodyEsperado,
        poloErrado,
        poloEsperado,
        parteIdPut: noPoloEsperado ? null : Number(noPoloErrado.id),
        parteIdDelete:
          noPoloEsperado && noPoloErrado.id !== noPoloEsperado.id
            ? Number(noPoloErrado.id)
            : null,
      });
      continue;
    }

    correcoes.push({
      tipo: 'criar',
      pt,
      bodyEsperado,
      poloErrado,
      poloEsperado,
      parteIdPut: null,
      parteIdDelete: null,
    });
  }

  return { correcoes, ok };
}

/**
 * @param {{ baseBanco?: string, clienteFiltro?: number | null }} [opts]
 */
export function listarRegistrosRequeridoComPartesTxt(opts = {}) {
  const baseProcMil = opts.baseProcMil ?? defaultBaseProcMil();
  const mapa = levantarCamposSemanticosProcesso({
    baseProcMil,
    clienteFiltro: opts.clienteFiltro ?? null,
  });

  /** @type {object[]} */
  const registros = [];
  for (const reg of mapa.values()) {
    if (reg.campos?.papelCliente !== 'REQUERIDO') continue;
    const partes = lerPartesProcessoTxt(opts.baseBanco, reg.codNum, reg.numeroInterno);
    if (!partes.length) continue;
    registros.push({
      cod8: reg.cod8,
      codNum: reg.codNum,
      numeroInterno: reg.numeroInterno,
      partes,
      fontePapel: reg.fontes?.papelCliente ?? null,
    });
  }

  registros.sort((a, b) => a.codNum - b.codNum || a.numeroInterno - b.numeroInterno);
  return registros;
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} processoId
 * @param {number} parteId
 */
export async function deleteParteProcesso(baseUrl, token, processoId, parteId) {
  const r = await fetch(`${baseUrl}/api/processos/${processoId}/partes/${parteId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, status: r.status, text: t };
  }
  return { ok: true };
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} processoId
 * @param {number} parteId
 * @param {object} body
 */
async function putParteCorrecao(baseUrl, token, processoId, parteId, body) {
  const payload = {
    ...body,
    importacaoId: ORIGEM_CORRECAO_REQUERIDO,
  };
  const r = await fetch(`${baseUrl}/api/processos/${processoId}/partes/${parteId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, status: r.status, text: t };
  }
  return { ok: true, data: await r.json() };
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} processoId
 * @param {object} body
 */
async function postParteCorrecao(baseUrl, token, processoId, body) {
  const payload = {
    ...body,
    importacaoId: ORIGEM_CORRECAO_REQUERIDO,
  };
  const r = await fetch(`${baseUrl}/api/processos/${processoId}/partes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, status: r.status, text: t };
  }
  return { ok: true, data: await r.json() };
}

/**
 * @param {object} opts — baseUrl, verbose
 * @param {string} token
 * @param {number} processoId
 * @param {import('./proc-processo-partes-txt.mjs').ParteProcessoTxt[]} partesTxt
 * @param {CorrecaoParteRequerido[]} correcoes
 * @param {boolean} aplicar
 */
export async function aplicarCorrecoesPartesRequerido(
  opts,
  token,
  processoId,
  partesTxt,
  correcoes,
  aplicar
) {
  const stats = {
    invertidos: 0,
    criados: 0,
    duplicadosRemovidos: 0,
    dryRunInvertir: 0,
    dryRunCriar: 0,
    dryRunRemover: 0,
    falhas: 0,
  };

  for (const c of correcoes) {
    if (c.tipo === 'inverter' && c.parteIdPut) {
      if (!aplicar) {
        stats.dryRunInvertir += 1;
        if (opts.verbose) {
          console.log(
            `  [dry-run PUT] pessoa ${c.pt.pessoaId} ordem ${c.bodyEsperado.ordem}: ${c.poloErrado} → ${c.poloEsperado} id=${c.parteIdPut}`
          );
        }
        continue;
      }
      const r = await putParteCorrecao(
        opts.baseUrl,
        token,
        processoId,
        c.parteIdPut,
        c.bodyEsperado
      );
      if (r.ok) {
        stats.invertidos += 1;
        if (opts.verbose) {
          console.log(
            `  [invertido] pessoa ${c.pt.pessoaId} ordem ${c.bodyEsperado.ordem}: ${c.poloErrado} → ${c.poloEsperado} id=${c.parteIdPut}`
          );
        }
      } else {
        stats.falhas += 1;
        console.warn(
          `  [falha PUT] pessoa ${c.pt.pessoaId}: ${r.status} ${(r.text || '').slice(0, 120)}`
        );
      }
    }

    if (c.tipo === 'criar') {
      if (!aplicar) {
        stats.dryRunCriar += 1;
        if (opts.verbose) {
          console.log(
            `  [dry-run POST] ${c.bodyEsperado.polo} ordem ${c.bodyEsperado.ordem} pessoa=${c.pt.pessoaId}`
          );
        }
        continue;
      }
      const r = await postParteCorrecao(opts.baseUrl, token, processoId, c.bodyEsperado);
      if (r.ok) {
        stats.criados += 1;
        if (opts.verbose) {
          console.log(
            `  [criado] ${c.bodyEsperado.polo} ordem ${c.bodyEsperado.ordem} pessoa=${c.pt.pessoaId}`
          );
        }
      } else {
        stats.falhas += 1;
        console.warn(
          `  [falha POST] pessoa ${c.pt.pessoaId}: ${r.status} ${(r.text || '').slice(0, 120)}`
        );
      }
    }

    if (c.parteIdDelete) {
      if (!aplicar) {
        stats.dryRunRemover += 1;
        if (opts.verbose) {
          console.log(`  [dry-run DELETE] parte id=${c.parteIdDelete} (polo ${c.poloErrado} duplicado)`);
        }
        continue;
      }
      const r = await deleteParteProcesso(opts.baseUrl, token, processoId, c.parteIdDelete);
      if (r.ok) {
        stats.duplicadosRemovidos += 1;
        if (opts.verbose) {
          console.log(`  [removido] parte id=${c.parteIdDelete} (polo ${c.poloErrado} duplicado)`);
        }
      } else {
        stats.falhas += 1;
        console.warn(
          `  [falha DELETE] id=${c.parteIdDelete}: ${r.status} ${(r.text || '').slice(0, 120)}`
        );
      }
    }
  }

  if (aplicar && partesTxt.length > 0) {
    const apiPos = await listarPartes(opts.baseUrl, token, processoId);
    const ver = analisarCorrecoesPartesRequerido(partesTxt, apiPos);
    if (ver.correcoes.length > 0) {
      stats.falhas += ver.correcoes.length;
      for (const f of ver.correcoes.slice(0, 3)) {
        console.error(
          `  [verificação] ainda pendente: pessoa ${f.pt.pessoaId} tipo=${f.tipo} esperado=${f.poloEsperado}`
        );
      }
    }
  }

  return stats;
}

/** Resumo legível do slot VBA (90 vs 95). */
export function slotVbaLabel(ladoVba) {
  if (ladoVba === POLO_PROCESSO_PARTE_CLIENTE) return '90 (cliente VBA)';
  if (ladoVba === POLO_PROCESSO_PARTE_OPOSTA) return '95 (oposta VBA)';
  return String(ladoVba ?? '');
}
