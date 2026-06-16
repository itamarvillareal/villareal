/**
 * API: **partes do processo** (POST/PUT `/api/processos/{id}/partes`).
 * Não grava `151.1.0` — isso é cadastro Clientes (`cliente-pessoa-151-txt.mjs`).
 */

import {
  assinaturaParteApi,
  parteTxtParaApiBody,
} from './proc-processo-partes-txt.mjs';
import { normalizarPapelClienteImport } from './legado-pessoa-cliente-vs-partes-processo.mjs';
import {
  analisarCorrecoesPartesRequerido,
  aplicarCorrecoesPartesRequerido,
} from './corrigir-partes-requerido-txt.mjs';
import { verificarPartesTxtContraApi } from './verificar-partes-processo-pos-import.mjs';

export const ORIGEM_IMPORT_PARTES = 'import-txt-partes-local';

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} pessoaId
 */
export async function validarPessoaCadastro(baseUrl, token, pessoaId) {
  const r = await fetch(`${baseUrl}/api/cadastro-pessoas/${pessoaId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, status: r.status, text: t };
  }
  const j = await r.json();
  return { ok: true, nome: j?.nome ?? null };
}

export async function listarPartes(baseUrl, token, processoId) {
  const r = await fetch(`${baseUrl}/api/processos/${processoId}/partes`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET partes proc ${processoId}: ${r.status} ${t.slice(0, 200)}`);
  }
  const list = await r.json();
  return Array.isArray(list) ? list : [];
}

async function postParte(baseUrl, token, processoId, body) {
  const payload = { ...body, importacaoId: ORIGEM_IMPORT_PARTES };
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

async function putParte(baseUrl, token, processoId, parteId, body) {
  const payload = { ...body, importacaoId: ORIGEM_IMPORT_PARTES };
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
 * Sincroniza partes do txt com a API (só acrescenta/atualiza; não apaga partes extra na API).
 * @param {object} opts — baseUrl, verbose
 * @param {string} token
 * @param {number} processoId
 * @param {import('./proc-processo-partes-txt.mjs').ParteProcessoTxt[]} partesTxt
 * @param {boolean} aplicar
 * @param {string | null | undefined} [papelCliente]
 */
export async function sincronizarPartesProcesso(opts, token, processoId, partesTxt, aplicar, papelCliente = null) {
  const papel = normalizarPapelClienteImport(papelCliente);
  if (papel === 'REQUERIDO') {
    const partesApi = await listarPartes(opts.baseUrl, token, processoId);
    const { correcoes, ok } = analisarCorrecoesPartesRequerido(partesTxt, partesApi);
    if (correcoes.length === 0) {
      return {
        criados: 0,
        atualizados: 0,
        iguais: ok,
        puladosSemPessoa: 0,
        puladosSemConteudo: 0,
        falhas: 0,
        verificacaoFalhas: 0,
        dryRunCriar: 0,
        dryRunAtualizar: 0,
      };
    }
    const st = await aplicarCorrecoesPartesRequerido(
      opts,
      token,
      processoId,
      partesTxt,
      correcoes,
      aplicar
    );
    return {
      criados: st.criados,
      atualizados: st.invertidos,
      iguais: ok,
      puladosSemPessoa: 0,
      puladosSemConteudo: 0,
      falhas: st.falhas,
      verificacaoFalhas: st.falhas > 0 ? 1 : 0,
      dryRunCriar: st.dryRunCriar,
      dryRunAtualizar: st.dryRunInvertir,
      duplicadosRemovidos: st.duplicadosRemovidos,
      dryRunRemover: st.dryRunRemover,
    };
  }

  const stats = {
    criados: 0,
    atualizados: 0,
    iguais: 0,
    puladosSemPessoa: 0,
    puladosSemConteudo: 0,
    falhas: 0,
    verificacaoFalhas: 0,
    dryRunCriar: 0,
    dryRunAtualizar: 0,
  };

  const existentes = await listarPartes(opts.baseUrl, token, processoId);
  /** @type {Map<string, object>} */
  const porSlot = new Map();
  for (const p of existentes) {
    const polo = String(p.polo ?? '').toUpperCase();
    const ordem = Number(p.ordem ?? 0);
    porSlot.set(`${polo}|${ordem}`, p);
  }

  for (const pt of partesTxt) {
    if (!pt.pessoaId) {
      stats.puladosSemConteudo += 1;
      continue;
    }

    if (pt.pessoaId != null) {
      const val = await validarPessoaCadastro(opts.baseUrl, token, pt.pessoaId);
      if (!val.ok) {
        stats.puladosSemPessoa += 1;
        stats.falhas += 1;
        console.warn(
          `  [sem pessoa] ${pt.ladoVba} ordem ${pt.ordem} — id ${pt.pessoaId} não existe na API (${val.status})`
        );
        continue;
      }
    }

    const body = parteTxtParaApiBody(pt, papelCliente);
    const slotKey = `${body.polo}|${body.ordem}`;
    const atual = porSlot.get(slotKey);

    if (atual?.id) {
      const mesmo = assinaturaParteApi(atual, null) === assinaturaParteApi(null, body);
      if (mesmo) {
        stats.iguais += 1;
        continue;
      }
      if (!aplicar) {
        stats.dryRunAtualizar += 1;
        if (opts.verbose) {
          console.log(
            `  [dry-run PUT] ${body.polo} ordem ${body.ordem} pessoa=${body.pessoaId ?? '—'} id=${atual.id}`
          );
        }
        continue;
      }
      const r = await putParte(opts.baseUrl, token, processoId, atual.id, body);
      if (r.ok) {
        stats.atualizados += 1;
        if (opts.verbose) {
          console.log(`  [actualizado] ${body.polo} ordem ${body.ordem} id=${atual.id} pessoa=${body.pessoaId}`);
        }
      } else {
        stats.falhas += 1;
        console.warn(`  [falha PUT] ${body.polo} ordem ${body.ordem}: ${r.status} ${(r.text || '').slice(0, 120)}`);
      }
      continue;
    }

    if (!aplicar) {
      stats.dryRunCriar += 1;
      if (opts.verbose) {
        console.log(
          `  [dry-run POST] ${body.polo} ordem ${body.ordem} pessoa=${body.pessoaId ?? '—'}`
        );
      }
      continue;
    }

    const r = await postParte(opts.baseUrl, token, processoId, body);
    if (r.ok) {
      stats.criados += 1;
      porSlot.set(slotKey, r.data);
      if (opts.verbose) {
        console.log(`  [criado] ${body.polo} ordem ${body.ordem} id=${r.data?.id} pessoa=${body.pessoaId}`);
      }
    } else {
      stats.falhas += 1;
      console.warn(`  [falha POST] ${body.polo} ordem ${body.ordem}: ${r.status} ${(r.text || '').slice(0, 120)}`);
    }
  }

  if (aplicar && partesTxt.length > 0) {
    const apiPos = await listarPartes(opts.baseUrl, token, processoId);
    const ver = verificarPartesTxtContraApi(partesTxt, apiPos, papelCliente);
    if (!ver.ok) {
      stats.verificacaoFalhas = ver.faltas.length;
      stats.falhas += ver.faltas.length;
      for (const f of ver.faltas.slice(0, 5)) {
        console.error(
          `  [verificação parte] ausente na API: ${f.chave} (fontes: ${(f.fontes || []).join(', ')})`
        );
      }
      if (ver.faltas.length > 5) {
        console.error(`  [verificação parte] … +${ver.faltas.length - 5} ausente(s)`);
      }
    }
  }

  return stats;
}
