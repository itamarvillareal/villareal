/**
 * Preenche lacunas em numero_interno movendo os N processos de maior número para os N menores buracos.
 * Espelha a sequência compacta do CobrancaUnidadeResolverService após exclusões.
 */

import { renumerarProcClienteMysql } from './renumerar-proc-cliente.mjs';

function padCod8(raw) {
  const n = Number(String(raw ?? '').replace(/\D/g, '') || NaN);
  if (!Number.isFinite(n) || n < 1) throw new Error(`Código cliente inválido: ${raw}`);
  return String(n).padStart(8, '0');
}

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {number} clienteId
 */
export async function listarLacunasProcCliente(conn, clienteId) {
  const [maxRow] = await conn.query(
    `SELECT MAX(numero_interno) AS mx, COUNT(*) AS total FROM processo WHERE cliente_id = ?`,
    [clienteId]
  );
  const maxNi = Number(maxRow[0]?.mx ?? 0);
  const total = Number(maxRow[0]?.total ?? 0);
  if (maxNi < 1 || total < 1) return { maxNi, total, lacunas: [] };

  const [usadosRows] = await conn.query(
    `SELECT numero_interno FROM processo WHERE cliente_id = ? AND numero_interno BETWEEN 1 AND ?`,
    [clienteId, maxNi]
  );
  const usados = new Set(usadosRows.map((r) => Number(r.numero_interno)));
  /** @type {number[]} */
  const lacunas = [];
  for (let n = 1; n <= maxNi; n += 1) {
    if (!usados.has(n)) lacunas.push(n);
  }
  return { maxNi, total, lacunas };
}

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {{ cod8: string, dryRun?: boolean, lacunaMin?: number }} opts
 */
export async function compactarLacunasProcClienteMysql(conn, opts) {
  const cod8 = padCod8(opts.cod8);
  const dryRun = opts.dryRun !== false;
  const lacunaMin = opts.lacunaMin != null ? Math.trunc(Number(opts.lacunaMin)) : 1;

  const [clienteRows] = await conn.query(
    `SELECT id FROM cliente WHERE TRIM(codigo_cliente) = ? LIMIT 1`,
    [cod8]
  );
  const clienteId = Number(clienteRows?.[0]?.id);
  if (!clienteId) throw new Error(`Cliente não encontrado: ${cod8}`);

  const { maxNi, total, lacunas: lacunasTodas } = await listarLacunasProcCliente(conn, clienteId);
  const lacunas = lacunasTodas.filter((n) => n >= lacunaMin);
  if (!lacunas.length) {
    return {
      ok: true,
      alterado: false,
      dryRun,
      cod8,
      maxNi,
      total,
      lacunas: [],
      movimentos: [],
      novoMaxNi: maxNi,
    };
  }

  const [existentesRows] = await conn.query(
    `SELECT p.numero_interno, p.id, p.unidade, p.ativo, p.importacao_id IS NOT NULL AS imp,
            EXISTS(
              SELECT 1 FROM calculo_rodada cr
              WHERE TRIM(cr.codigo_cliente) = ? AND cr.numero_processo = p.numero_interno
                AND cr.parcelamento_aceito = 1
            ) AS negociado
     FROM processo p
     WHERE p.cliente_id = ?
     ORDER BY p.numero_interno DESC`,
    [cod8, clienteId]
  );

  /** @type {Map<number, typeof existentesRows[0]>} */
  const porNumero = new Map(existentesRows.map((r) => [Number(r.numero_interno), r]));
  /** @type {number[]} */
  const fontes = existentesRows.map((r) => Number(r.numero_interno)).slice(0, lacunas.length);
  if (fontes.length < lacunas.length) {
    throw new Error(
      `Lacunas (${lacunas.length}) > processos disponíveis para mover (${fontes.length}).`
    );
  }

  /** @type {{ de: number, para: number, processoId: number, unidade: string|null, imp: boolean, negociado: boolean }[]} */
  const movimentos = lacunas.map((para, i) => {
    const de = fontes[i];
    const row = porNumero.get(de);
    if (!row) throw new Error(`Processo ${de} não encontrado.`);
    return {
      de,
      para,
      processoId: Number(row.id),
      unidade: row.unidade ?? null,
      imp: Boolean(row.imp),
      negociado: Boolean(row.negociado),
    };
  }).filter((m) => m.de !== m.para);

  if (!movimentos.length) {
    return {
      ok: true,
      alterado: false,
      dryRun,
      cod8,
      maxNi,
      total,
      lacunas,
      movimentos: [],
      novoMaxNi: maxNi,
    };
  }

  if (dryRun) {
    return {
      ok: true,
      alterado: true,
      dryRun: true,
      cod8,
      maxNi,
      total,
      lacunas,
      movimentos,
      novoMaxNi: maxNi - movimentos.length,
      negociadosRenumerados: movimentos.filter((m) => m.negociado),
    };
  }

  /** @type {typeof movimentos} */
  const aplicados = [];
  const tempBase = maxNi + 10_000;
  for (let i = 0; i < movimentos.length; i += 1) {
    const mov = movimentos[i];
    const temp = tempBase + i;
    await renumerarProcClienteMysql(conn, { cod8, de: mov.de, para: temp, dryRun: false });
  }
  for (let i = 0; i < movimentos.length; i += 1) {
    const mov = movimentos[i];
    const temp = tempBase + i;
    await renumerarProcClienteMysql(conn, { cod8, de: temp, para: mov.para, dryRun: false });
    aplicados.push(mov);
  }

  const pos = await listarLacunasProcCliente(conn, clienteId);
  return {
    ok: true,
    alterado: true,
    dryRun: false,
    cod8,
    maxNi,
    total,
    lacunas,
    movimentos: aplicados,
    novoMaxNi: pos.maxNi,
    lacunasRestantes: pos.lacunas.length,
  };
}
