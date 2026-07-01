/**
 * Renumera processo + cálculos + agenda de (cod8, de) → (para).
 * Espelha a regra de sequência compacta (stub 1474 → 75).
 */

import { conectarMysqlVilareal } from './mysql-vilareal.mjs';

function padCod8(raw) {
  const n = Number(String(raw ?? '').replace(/\D/g, '') || NaN);
  if (!Number.isFinite(n) || n < 1) throw new Error(`Código cliente inválido: ${raw}`);
  return String(n).padStart(8, '0');
}

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {{ cod8: string, de: number, para: number, dryRun?: boolean }} opts
 */
export async function renumerarProcClienteMysql(conn, opts) {
  const cod8 = padCod8(opts.cod8);
  const de = Math.trunc(Number(opts.de));
  const para = Math.trunc(Number(opts.para));
  const dryRun = opts.dryRun !== false;
  if (de < 1 || para < 1) throw new Error('Números de processo devem ser ≥ 1.');
  if (de === para) return { ok: true, alterado: false, motivo: 'origem e destino iguais' };

  const [clienteRows] = await conn.query(
    `SELECT id FROM cliente WHERE TRIM(codigo_cliente) = ? LIMIT 1`,
    [cod8]
  );
  const clienteRow = clienteRows?.[0];
  if (!clienteRow?.id) throw new Error(`Cliente não encontrado: ${cod8}`);
  const clienteId = Number(clienteRow.id);

  const [procs] = await conn.query(
    `SELECT id, numero_interno, unidade, ativo
     FROM processo
     WHERE cliente_id = ? AND numero_interno IN (?, ?)
     ORDER BY numero_interno ASC`,
    [clienteId, de, para]
  );
  const origem = procs.find((p) => Number(p.numero_interno) === de);
  const destino = procs.find((p) => Number(p.numero_interno) === para);
  if (!origem) throw new Error(`Processo ${cod8}/${de} não encontrado.`);

  const [calculoOrigem] = await conn.query(
    `SELECT dimensao FROM calculo_rodada
     WHERE TRIM(codigo_cliente) = ? AND numero_processo = ?`,
    [cod8, de]
  );
  const [calculoDestino] = destino
    ? await conn.query(
        `SELECT dimensao FROM calculo_rodada
         WHERE TRIM(codigo_cliente) = ? AND numero_processo = ?`,
        [cod8, para]
      )
    : [[]];

  if (destino && calculoDestino.length > 0) {
    throw new Error(
      `Processo destino ${cod8}/${para} já existe com ${calculoDestino.length} rodada(s) de cálculo.`
    );
  }

  const refDe = `${cod8}|${de}`;
  const refPara = `${cod8}|${para}`;
  const plano = {
    cod8,
    de,
    para,
    processoId: Number(origem.id),
    unidade: origem.unidade ?? null,
    calculoDimsOrigem: calculoOrigem.map((r) => Number(r.dimensao)),
    destinoExistente: Boolean(destino),
    refAgendaDe: refDe,
    refAgendaPara: refPara,
  };

  if (dryRun) {
    return { ok: true, dryRun: true, plano };
  }

  await conn.query('START TRANSACTION');
  try {
    if (destino) {
      await conn.query(`DELETE FROM processo WHERE id = ?`, [Number(destino.id)]);
    }

    await conn.query(`UPDATE processo SET numero_interno = ? WHERE id = ?`, [para, Number(origem.id)]);

    await conn.query(
      `UPDATE calculo_rodada SET numero_processo = ?
       WHERE TRIM(codigo_cliente) = ? AND numero_processo = ?`,
      [para, cod8, de]
    );

    await conn.query(
      `UPDATE agenda_evento SET processo_ref = ?
       WHERE processo_ref = ?`,
      [refPara, refDe]
    );

    await conn.query('COMMIT');
    return { ok: true, dryRun: false, plano };
  } catch (err) {
    await conn.query('ROLLBACK');
    throw err;
  }
}
