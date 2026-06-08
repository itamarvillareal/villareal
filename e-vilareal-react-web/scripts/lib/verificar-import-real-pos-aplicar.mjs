/**
 * Verificação pós-import do import-real: API + MySQL alinhados aos txt.
 */

import fs from 'node:fs';

import {
  carregarBundleCalculosCliente,
  dirCalculosCliente,
} from './calculos-dropbox-txt.mjs';
import { formatCod8 } from './historico-local-txt-paths.mjs';
import { conectarMysqlVilareal } from './mysql-vilareal.mjs';
import { listarPartes } from './proc-processo-partes-api.mjs';
import {
  lerPartesProcessoTxt,
  listarProcessosComPartesTxt,
} from './proc-processo-partes-txt.mjs';
import {
  verificarParteOpostaListagem,
  verificarPartesTxtContraApi,
} from './verificar-partes-processo-pos-import.mjs';
import { buscarProcesso, loginImportApi } from './vilareal-import-processo-api.mjs';

/**
 * @param {number[]} procs
 * @param {{ processo?: number | null, processoMin?: number | null, processoMax?: number | null }} opts
 */
function filtrarProcessos(procs, opts) {
  return procs.filter((p) => {
    if (opts.processo != null && p !== opts.processo) return false;
    if (opts.processoMin != null && p < opts.processoMin) return false;
    if (opts.processoMax != null && p > opts.processoMax) return false;
    return true;
  });
}

/**
 * @param {{
 *   cliente: number,
 *   base: string,
 *   baseUrl: string,
 *   login: string,
 *   senha: string,
 *   semPartes?: boolean,
 *   semCalculos?: boolean,
 *   processo?: number | null,
 *   processoMin?: number | null,
 *   processoMax?: number | null,
 *   procsGarantir?: number[],
 * }} opts
 */
export async function verificarImportRealPosAplicar(opts) {
  const codNum = Math.trunc(Number(opts.cliente));
  const cod8 = formatCod8(codNum);
  /** @type {object[]} */
  const issues = [];

  const token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
  const clientePorCod8 = new Map();

  for (const ni of opts.procsGarantir ?? []) {
    const proc = await buscarProcesso(opts.baseUrl, token, cod8, ni, clientePorCod8);
    if (!proc?.id) {
      issues.push({ tipo: 'processo_ausente_api', numeroInterno: ni });
    }
  }

  const conn = await conectarMysqlVilareal();
  try {
    if (!opts.semPartes) {
      const procsPartes = filtrarProcessos(listarProcessosComPartesTxt(opts.base, codNum), opts);
      for (const ni of procsPartes) {
        const partesTxt = lerPartesProcessoTxt(opts.base, codNum, ni);
        if (partesTxt.length === 0) continue;

        const proc = await buscarProcesso(opts.baseUrl, token, cod8, ni, clientePorCod8);
        if (!proc?.id) {
          issues.push({
            tipo: 'partes_orfao',
            numeroInterno: ni,
            partesTxt: partesTxt.length,
          });
          continue;
        }

        const partesApi = await listarPartes(opts.baseUrl, token, proc.id);
        const verPartes = verificarPartesTxtContraApi(partesTxt, partesApi);
        if (!verPartes.ok) {
          for (const f of verPartes.faltas) {
            issues.push({
              tipo: 'parte_ausente_api',
              numeroInterno: ni,
              processoId: proc.id,
              chave: f.chave,
              pessoaId: f.pessoaId,
              ladoVba: f.ladoVba,
              ordem: f.ordem,
              fontes: f.fontes,
            });
          }
        }

        const verPo = verificarParteOpostaListagem(partesTxt, proc.parteOposta, partesApi);
        if (!verPo.ok) {
          issues.push({
            tipo: 'parte_oposta_listagem_vazia',
            numeroInterno: ni,
            processoId: proc.id,
            partesTxt: partesTxt.length,
            partesApi: partesApi.length,
            motivo: verPo.motivo,
          });
        }

        const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM processo_parte WHERE processo_id = ?`, [
          proc.id,
        ]);
        const nPartes = Number(rows[0]?.n ?? 0);
        if (nPartes < partesTxt.length) {
          issues.push({
            tipo: 'partes_mysql_insuficientes',
            numeroInterno: ni,
            processoId: proc.id,
            partesTxt: partesTxt.length,
            partesMysql: nPartes,
          });
        }
      }
    }

    if (!opts.semCalculos) {
      const dir = dirCalculosCliente(codNum, opts.base);
      if (fs.existsSync(dir)) {
        const bundle = carregarBundleCalculosCliente(codNum, {
          baseBanco: opts.base,
          processoMin: opts.processoMin ?? undefined,
          processoMax: opts.processoMax ?? undefined,
        });
        for (const [, rodada] of bundle.porRodada) {
          if (opts.processo != null && rodada.numeroProcesso !== opts.processo) continue;
          if (opts.processoMin != null && rodada.numeroProcesso < opts.processoMin) continue;
          if (opts.processoMax != null && rodada.numeroProcesso > opts.processoMax) continue;

          const [rows] = await conn.query(
            `SELECT COUNT(*) AS n FROM calculo_rodada
             WHERE TRIM(codigo_cliente) = ? AND numero_processo = ? AND dimensao = ?`,
            [cod8, rodada.numeroProcesso, rodada.dimensao],
          );
          if (Number(rows[0]?.n ?? 0) < 1) {
            issues.push({
              tipo: 'calculo_ausente_mysql',
              key: rodada.key,
              numeroInterno: rodada.numeroProcesso,
              dimensao: rodada.dimensao,
            });
          }
        }
      }
    }
  } finally {
    await conn.end();
  }

  const ok = issues.length === 0;
  return { ok, issues, exitCode: ok ? 0 : 3 };
}

/**
 * @param {{ ok: boolean, issues: object[] }} ver
 */
export function imprimirVerificacaoImportReal(ver) {
  if (ver.ok) {
    console.log('\n[verificação] OK — processos, partes (txt↔API), listagem e cálculos conferidos.\n');
    return;
  }
  console.error(`\n[verificação] ${ver.issues.length} problema(s) pós-import:`);
  for (const issue of ver.issues.slice(0, 30)) {
    console.error(`  - ${issue.tipo}: ${JSON.stringify(issue)}`);
  }
  if (ver.issues.length > 30) {
    console.error(`  ... +${ver.issues.length - 30} problema(s)`);
  }
  console.error('');
}
