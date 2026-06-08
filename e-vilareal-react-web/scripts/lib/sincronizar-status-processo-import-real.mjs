/**
 * Sincroniza `processo.ativo` (e limpa fase/obs. quando INATIVO) a partir dos txt Status.Processo.
 */

import path from 'node:path';

import {
  listarStatusProcessoPorCliente,
  resolverAtivoFromStatusProcessoTxt,
} from './gerais-fase-processo-txt.mjs';
import { atualizarProcessoApi } from './import-processo-put-body.mjs';
import { formatCod8 } from './historico-local-txt-paths.mjs';
import {
  buscarProcesso,
  loginImportApi,
} from './vilareal-import-processo-api.mjs';
import { resolverBaseUrlImport } from './vilareal-import-api-base.mjs';

/**
 * @param {object} statusReg
 * @returns {Record<string, unknown>}
 */
export function montarPatchStatusProcesso(statusReg) {
  const st = statusReg ?? resolverAtivoFromStatusProcessoTxt(null);
  /** @type {Record<string, unknown>} */
  const patch = { ativo: st.ativo };
  if (st.statusInativo) {
    patch.observacaoFase = null;
    patch.fase = null;
  }
  return patch;
}

function filtrarRegistos(registos, opts) {
  let out = registos;
  if (opts.processo != null) {
    out = out.filter((r) => r.numeroInterno === opts.processo);
  }
  if (opts.processoMin != null) {
    out = out.filter((r) => r.numeroInterno >= opts.processoMin);
  }
  if (opts.processoMax != null) {
    out = out.filter((r) => r.numeroInterno <= opts.processoMax);
  }
  return out;
}

function precisaAplicarStatus(proc, patch) {
  const ativoApi = proc.ativo !== false;
  const ativoTxt = patch.ativo !== false;
  if (ativoApi !== ativoTxt) return true;
  if (patch.ativo === false) {
    const obs = proc.observacaoFase == null ? '' : String(proc.observacaoFase).trim();
    const fase = proc.fase == null ? '' : String(proc.fase).trim();
    if (obs !== '' || fase !== '') return true;
  }
  return false;
}

/**
 * @param {object} opts — cliente, processo?, processoMin?, processoMax?, base, login, senha, dryRun
 * @param {{ baseUrl?: string }} [ctx]
 */
export async function sincronizarStatusProcessoImportReal(opts, ctx = {}) {
  const baseUrl = (ctx.baseUrl ?? resolverBaseUrlImport()).replace(/\/$/, '');
  const baseGeraisMil = path.join(opts.base, 'Gerais', '1000');
  const registos = filtrarRegistos(
    listarStatusProcessoPorCliente(baseGeraisMil, opts.cliente),
    opts
  );

  const stats = {
    txtStatus: registos.length,
    inativos: registos.filter((r) => r.statusInativo).length,
    ativos: registos.filter((r) => !r.statusInativo).length,
    aplicados: 0,
    pulados_igual: 0,
    sem_processo_api: 0,
    falhas: 0,
    detalhes: [],
  };

  if (opts.dryRun) {
    for (const reg of registos) {
      console.log(
        `  [status dry-run] ${reg.cod8}/${reg.numeroInterno}: ${JSON.stringify(reg.statusBruto ?? '(vazio)')} → ativo=${reg.ativo}`
      );
    }
    return stats;
  }

  if (!opts.senha) {
    throw new Error('VILAREAL_IMPORT_SENHA necessária para sincronizar status');
  }

  const token =
    ctx.token ?? (await loginImportApi(baseUrl, opts.login, opts.senha));
  const pessoaPorCod8 = new Map();
  const cod8 = formatCod8(opts.cliente);

  for (const reg of registos) {
    const patch = montarPatchStatusProcesso(reg);
    const proc = await buscarProcesso(baseUrl, token, cod8, reg.numeroInterno, pessoaPorCod8);
    if (!proc?.id) {
      stats.sem_processo_api += 1;
      stats.detalhes.push({
        processo: reg.numeroInterno,
        status: reg.statusBruto,
        acao: 'sem_processo_api',
      });
      console.warn(
        `[status] ${cod8}/${reg.numeroInterno}: processo ausente na API — ${reg.statusInativo ? 'INATIVO' : 'ATIVO'} não aplicado`
      );
      continue;
    }
    if (!precisaAplicarStatus(proc, patch)) {
      stats.pulados_igual += 1;
      continue;
    }
    try {
      await atualizarProcessoApi(baseUrl, token, proc, patch);
      stats.aplicados += 1;
      console.log(
        `[status] ${cod8}/${reg.numeroInterno}: ${JSON.stringify(reg.statusBruto ?? '(vazio)')} → ativo=${patch.ativo}`
      );
      stats.detalhes.push({
        processo: reg.numeroInterno,
        status: reg.statusBruto,
        ativo: patch.ativo,
        acao: 'atualizado',
      });
    } catch (e) {
      stats.falhas += 1;
      stats.detalhes.push({
        processo: reg.numeroInterno,
        status: reg.statusBruto,
        acao: 'erro',
        erro: e?.message || String(e),
      });
      console.warn(`[status] ${cod8}/${reg.numeroInterno}: erro —`, e?.message || e);
    }
  }

  return stats;
}
