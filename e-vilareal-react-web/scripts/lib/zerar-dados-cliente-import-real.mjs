/**
 * Zera na base os dados do cliente que o import-real volta a carregar dos txt
 * (evita lixo acumulado entre reimportações).
 * Alinha `cliente.pessoa_id` ao `151.1.0` e remove processos MySQL fora da lista Dropbox.
 */

import {
  lerNumeroPessoaCliente151Txt,
  migrarProcessosNumerosInternosMysql,
  substituirVinculoClientePessoaMysql,
} from './cliente-pessoa-151-txt.mjs';
import { resolverBaseBancoDados } from './gerais-fase-processo-txt.mjs';
import { formatCod8 } from './historico-local-txt-paths.mjs';
import { conectarMysqlVilareal } from './mysql-vilareal.mjs';
import { removerProcessosForaDropboxMysql } from './processos-dropbox-cliente.mjs';
import {
  COLUNAS_PROCESSO_TXT_CABECALHO,
  COLUNAS_PROCESSO_TXT_SEMANTICO,
  sqlZerarColunasProcesso,
} from './campos-processo-txt-api.mjs';

const COLUNAS_ZERAR = [...COLUNAS_PROCESSO_TXT_SEMANTICO, ...COLUNAS_PROCESSO_TXT_CABECALHO];

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {number} pessoaId
 * @param {number | null} numeroInterno
 * @param {number[] | null} numerosDropbox
 */
async function listarProcessoIds(conn, pessoaId, numeroInterno, numerosDropbox) {
  const params = [pessoaId];
  let sql = `SELECT id, numero_interno AS ni FROM processo WHERE pessoa_id = ?`;
  if (numeroInterno != null) {
    sql += ` AND numero_interno = ?`;
    params.push(numeroInterno);
  } else if (numerosDropbox?.length) {
    const ph = numerosDropbox.map(() => '?').join(',');
    sql += ` AND numero_interno IN (${ph})`;
    params.push(...numerosDropbox);
  }
  const [rows] = await conn.query(sql, params);
  return rows.map((r) => ({ id: Number(r.id), ni: Number(r.ni) }));
}

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {number[]} processoIds
 */
async function contarPorProcessos(conn, processoIds) {
  if (processoIds.length === 0) {
    return { andamentos: 0, partes: 0, imoveis: 0, processos: 0 };
  }
  const ph = processoIds.map(() => '?').join(',');
  const [[a], [p], [i]] = await Promise.all([
    conn.query(`SELECT COUNT(*) AS n FROM processo_andamento WHERE processo_id IN (${ph})`, processoIds),
    conn.query(`SELECT COUNT(*) AS n FROM processo_parte WHERE processo_id IN (${ph})`, processoIds),
    conn.query(`SELECT COUNT(*) AS n FROM imovel WHERE processo_id IN (${ph})`, processoIds),
  ]);
  return {
    andamentos: Number(a[0]?.n ?? 0),
    partes: Number(p[0]?.n ?? 0),
    imoveis: Number(i[0]?.n ?? 0),
    processos: processoIds.length,
  };
}

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {string} cod8
 */
async function contarCalculos(conn, cod8) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM calculo_rodada WHERE TRIM(codigo_cliente) = ?`,
    [cod8],
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * @param {{
 *   cliente: number,
 *   processo?: number | null,
 *   dryRun?: boolean,
 *   baseBanco?: string,
 *   processosDropbox?: number[],
 * }} opts
 */
export async function zerarDadosClienteImportReal(opts) {
  const codNum = Math.trunc(Number(opts.cliente));
  const cod8 = formatCod8(codNum);
  const numeroInterno = opts.processo != null ? Math.trunc(Number(opts.processo)) : null;
  const dryRun = opts.dryRun !== false;
  const baseBanco = opts.baseBanco ?? resolverBaseBancoDados();
  const numsDropbox = (opts.processosDropbox ?? [])
    .map((n) => Math.trunc(Number(n)))
    .filter((n) => Number.isFinite(n) && n >= 1);
  const numsZerar =
    numeroInterno != null
      ? [numeroInterno]
      : numsDropbox.length > 0
        ? numsDropbox
        : null;

  if (!process.env.VILAREAL_MYSQL_DOCKER?.trim()) {
    process.env.VILAREAL_MYSQL_DOCKER = 'vilareal-db';
  }

  const conn = await conectarMysqlVilareal();
  /** @type {Record<string, number | string | null>} */
  const stats = {
    cliente: codNum,
    codigoCliente8: cod8,
    dryRun,
    processosDropbox: numsDropbox.length,
  };

  try {
    const [pesRows] = await conn.query(
      `SELECT p.id AS pessoa_id FROM pessoa p
       INNER JOIN cliente c ON c.pessoa_id = p.id
       WHERE TRIM(c.codigo_cliente) = ? OR TRIM(c.codigo_cliente) = ?
       LIMIT 1`,
      [cod8, String(codNum)],
    );
    const pessoaId = Number(pesRows[0]?.pessoa_id);
    if (!Number.isFinite(pessoaId) || pessoaId < 1) {
      stats.erro = 'cliente_nao_encontrado_na_base';
      return stats;
    }
    stats.pessoaIdZerar = pessoaId;
    stats.pessoaId = pessoaId;

    const processos = await listarProcessoIds(conn, pessoaId, numeroInterno, numsZerar);
    const processoIds = processos.map((p) => p.id);
    const contagens = await contarPorProcessos(conn, processoIds);
    const calculos = await contarCalculos(conn, cod8);

    Object.assign(stats, contagens, { calculosRodadas: calculos });

    const txtPessoaDry = lerNumeroPessoaCliente151Txt(codNum, { baseBanco });
    if (txtPessoaDry.pessoaId) {
      stats.pessoaIdTxt = txtPessoaDry.pessoaId;
      if (stats.pessoaId !== txtPessoaDry.pessoaId) {
        stats.pessoaVinculoPrevisto = 'substituir';
      } else {
        stats.pessoaVinculoPrevisto = 'ja_ok';
      }
    } else {
      stats.pessoaVinculoPrevisto = 'sem_txt';
    }

    if (dryRun) {
      const [[cMysql]] = await conn.query(`SELECT COUNT(*) AS n FROM processo WHERE pessoa_id = ?`, [
        pessoaId,
      ]);
      stats.processosMysql = Number(cMysql?.n ?? 0);
      stats.processosForaDropboxEstimados = Math.max(0, stats.processosMysql - numsDropbox.length);
      stats.status = 'simulacao';
      return stats;
    }

    if (processoIds.length > 0) {
      const ph = processoIds.map(() => '?').join(',');
      await conn.query(
        `UPDATE processo_prazo SET andamento_id = NULL
         WHERE andamento_id IN (
           SELECT id FROM processo_andamento WHERE processo_id IN (${ph})
         )`,
        processoIds,
      );
      const [delAnd] = await conn.query(
        `DELETE FROM processo_andamento WHERE processo_id IN (${ph})`,
        processoIds,
      );
      stats.andamentosRemovidos = delAnd.affectedRows ?? contagens.andamentos;

      await conn.query(
        `DELETE ppa FROM processo_parte_advogado ppa
         INNER JOIN processo_parte pp ON pp.id = ppa.processo_parte_id
         WHERE pp.processo_id IN (${ph})`,
        processoIds,
      );
      const [delPartes] = await conn.query(
        `DELETE FROM processo_parte WHERE processo_id IN (${ph})`,
        processoIds,
      );
      stats.partesRemovidas = delPartes.affectedRows ?? contagens.partes;

      const [updImo] = await conn.query(
        `UPDATE imovel SET processo_id = NULL WHERE processo_id IN (${ph})`,
        processoIds,
      );
      stats.imoveisDesvinculados = updImo.affectedRows ?? contagens.imoveis;

      let sqlProc = sqlZerarColunasProcesso(COLUNAS_ZERAR);
      sqlProc += ` WHERE pessoa_id = ?`;
      const procParams = [pessoaId];
      if (numeroInterno != null) {
        sqlProc += ` AND numero_interno = ?`;
        procParams.push(numeroInterno);
      } else if (numsDropbox.length > 0) {
        const phNi = numsDropbox.map(() => '?').join(',');
        sqlProc += ` AND numero_interno IN (${phNi})`;
        procParams.push(...numsDropbox);
      }
      const [updProc] = await conn.query(sqlProc, procParams);
      stats.processosAtualizados = updProc.affectedRows ?? 0;
    }

    const [delCalc] = await conn.query(`DELETE FROM calculo_rodada WHERE TRIM(codigo_cliente) = ?`, [
      cod8,
    ]);
    stats.calculosRemovidos = delCalc.affectedRows ?? calculos;

    const txtPessoa = lerNumeroPessoaCliente151Txt(codNum, { baseBanco });
    if (txtPessoa.pessoaId) {
      const pessoaIdAnterior = stats.pessoaIdZerar ?? stats.pessoaId;
      const sub = await substituirVinculoClientePessoaMysql(
        conn,
        cod8,
        txtPessoa.pessoaId,
        numsDropbox
      );
      stats.pessoaVinculo = sub;
      if (sub.acao === 'atualizado_mysql' || sub.acao === 'ja_ok') {
        stats.pessoaId = sub.pessoaId;
      }
      if (sub.acao === 'atualizado_mysql') {
        stats.pessoaIdAnterior = sub.pessoaIdAnterior ?? pessoaIdAnterior;
        stats.pessoaIdNovo = sub.pessoaId;
        stats.migracaoProcessos = sub.migracao;
      } else if (
        sub.acao === 'ja_ok' &&
        pessoaIdAnterior !== sub.pessoaId &&
        txtPessoa.pessoaId === sub.pessoaId
      ) {
        stats.migracaoProcessos = await migrarProcessosNumerosInternosMysql(
          conn,
          pessoaIdAnterior,
          sub.pessoaId,
          numsDropbox
        );
      }
    } else {
      stats.pessoaVinculo = {
        acao: 'sem_txt',
        aviso: txtPessoa.aviso ?? (txtPessoa.arquivo ? 'vazio' : 'ausente'),
      };
    }

    if (numeroInterno == null && stats.pessoaId) {
      const alinhamento = await removerProcessosForaDropboxMysql(conn, stats.pessoaId, numsDropbox);
      stats.alinhamentoDropbox = alinhamento;
    }

    stats.status = 'ok';
    return stats;
  } finally {
    await conn.end();
  }
}

/**
 * @param {Record<string, unknown>} stats
 */
export function imprimirResumoZerarCliente(stats) {
  console.log(`  Cliente: ${stats.cliente} (${stats.codigoCliente8})`);
  const pessoaZerar = stats.pessoaIdZerar ?? stats.pessoaId;
  if (pessoaZerar) console.log(`  Pessoa id (processos zerados): ${pessoaZerar}`);
  if (stats.erro) {
    console.log(`  Erro: ${stats.erro}`);
    return;
  }
  console.log(`  Processos Dropbox (txt): ${stats.processosDropbox ?? '?'}`);
  console.log(
    `  Processos MySQL (zerados): ${stats.processos} | Andamentos: ${stats.andamentos} | Partes: ${stats.partes} | Imóveis vinc.: ${stats.imoveis} | Cálculos: ${stats.calculosRodadas}`,
  );
  if (stats.dryRun) {
    console.log(
      `  MySQL total pessoa: ${stats.processosMysql ?? '?'} | fora Dropbox (estim.): ${stats.processosForaDropboxEstimados ?? '?'}`,
    );
    console.log('  (simulação — nada apagado)\n');
    return;
  }
  console.log(
    `  Removido/atualizado: andamentos=${stats.andamentosRemovidos ?? 0} partes=${stats.partesRemovidas ?? 0} imóveis=${stats.imoveisDesvinculados ?? 0} processos(campos)=${stats.processosAtualizados ?? 0} calculos=${stats.calculosRemovidos ?? 0}`,
  );
  if (stats.pessoaIdTxt != null) {
    console.log(
      `  Pessoa (151.1.0) txt: ${stats.pessoaIdTxt}${stats.pessoaVinculoPrevisto ? ` → ${stats.pessoaVinculoPrevisto}` : ''}`,
    );
  }
  if (stats.migracaoProcessos) {
    const m = stats.migracaoProcessos;
    console.log(
      `  Migração pessoa_id (só nº Dropbox): ${m.processosMigrados ?? 0} processo(s), conflitos=${m.processosConflito ?? 0}`,
    );
  }
  if (stats.alinhamentoDropbox) {
    const a = stats.alinhamentoDropbox;
    console.log(
      `  Alinhamento Dropbox: removidos ${a.removidos ?? 0} processo(s) fora dos txt → MySQL=${a.processosMysql ?? 0} (meta ${stats.processosDropbox ?? '?'})`,
    );
    if (a.removidos > 0 && a.numerosRemovidos?.length) {
      console.log(`  Removidos (amostra nº interno): ${a.numerosRemovidos.join(', ')}`);
    }
  }
  if (stats.pessoaVinculo?.acao === 'atualizado_mysql') {
    console.log(
      `  Pessoa vínculo: ${stats.pessoaIdAnterior} → ${stats.pessoaIdNovo} (151.1.0)`,
    );
  } else if (stats.pessoaVinculo?.acao === 'ja_ok' && stats.pessoaIdTxt != null) {
    console.log(`  Pessoa vínculo: já ${stats.pessoaId} (= txt)`);
  } else if (stats.pessoaVinculo?.acao === 'pessoa_inexistente') {
    console.log(`  Pessoa vínculo: pessoa ${stats.pessoaVinculo.pessoaId} inexistente na base`);
  } else if (stats.pessoaVinculo?.acao === 'sem_txt') {
    console.log(`  Pessoa vínculo: sem 151.1.0 válido (${stats.pessoaVinculo.aviso ?? 'ausente'})`);
  }
  console.log('');
}
