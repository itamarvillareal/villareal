/**
 * Limpeza em massa de prazos fatais no MySQL (cabeçalho + entidade processo_prazo).
 */

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 */
export async function limparTodosPrazosFataisMysql(conn) {
  await conn.query('UPDATE processo SET prazo_fatal = NULL WHERE prazo_fatal IS NOT NULL');
  await conn.query(
    `UPDATE processo_prazo
     SET prazo_fatal = FALSE, status = 'CANCELADO'
     WHERE prazo_fatal = TRUE`
  );
  return contarPrazosFataisMysql(conn);
}

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 */
export async function contarPrazosFataisMysql(conn) {
  const [rowsCab] = await conn.query(
    'SELECT COUNT(*) AS n FROM processo WHERE prazo_fatal IS NOT NULL'
  );
  const [rowsPrazo] = await conn.query(
    'SELECT COUNT(*) AS n FROM processo_prazo WHERE prazo_fatal = TRUE'
  );
  const [rowsProc] = await conn.query(
    `SELECT COUNT(DISTINCT pp.processo_id) AS n
     FROM processo_prazo pp
     WHERE pp.prazo_fatal = TRUE`
  );
  return {
    comPrazoFatalCabecalho: Number(rowsCab[0]?.n ?? 0),
    linhasPrazoFatalEntidade: Number(rowsPrazo[0]?.n ?? 0),
    processosComPrazoFatalEntidade: Number(rowsProc[0]?.n ?? 0),
  };
}

/**
 * Grava prazos fatais canónicos (txt VB) em processo + processo_prazo.
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {Array<{ cod8: string, numeroInterno: number, prazoFatalIso: string }>} registos
 */
export async function aplicarPrazosFataisCanonicalMysql(conn, registos) {
  let cabecalhos = 0;
  let prazosEntidade = 0;
  let semProcesso = 0;

  for (const reg of registos) {
    const [rows] = await conn.query(
      `SELECT p.id
       FROM processo p
       INNER JOIN cliente c ON c.id = p.cliente_id
       WHERE LPAD(TRIM(c.codigo_cliente), 8, '0') = ?
         AND p.numero_interno = ?
       LIMIT 1`,
      [reg.cod8, reg.numeroInterno]
    );
    const processoId = rows[0]?.id != null ? Number(rows[0].id) : null;
    if (!processoId) {
      semProcesso += 1;
      continue;
    }

    await conn.query('UPDATE processo SET prazo_fatal = ? WHERE id = ?', [
      reg.prazoFatalIso,
      processoId,
    ]);
    cabecalhos += 1;

    const [exist] = await conn.query(
      `SELECT id FROM processo_prazo
       WHERE processo_id = ? AND prazo_fatal = TRUE
       ORDER BY id ASC
       LIMIT 1`,
      [processoId]
    );
    const prazoId = exist[0]?.id != null ? Number(exist[0].id) : null;
    if (prazoId) {
      await conn.query(
        `UPDATE processo_prazo
         SET data_fim = ?, prazo_fatal = TRUE, status = 'PENDENTE',
             descricao = 'Prazo fatal do processo'
         WHERE id = ?`,
        [reg.prazoFatalIso, prazoId]
      );
    } else {
      await conn.query(
        `INSERT INTO processo_prazo (processo_id, data_fim, prazo_fatal, status, descricao)
         VALUES (?, ?, TRUE, 'PENDENTE', 'Prazo fatal do processo')`,
        [processoId, reg.prazoFatalIso]
      );
    }
    prazosEntidade += 1;
  }

  return { cabecalhos, prazosEntidade, semProcesso };
}
