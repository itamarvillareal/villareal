/**
 * Exclusão de processos no MySQL — espelha `ProcessoExclusaoService` (Java).
 */

/** @param {number} n */
function placeholders(n) {
  return Array.from({ length: n }, () => '?').join(',');
}

/** @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn */
async function execOpcional(conn, sql, params = []) {
  try {
    return await conn.query(sql, params);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ER_NO_SUCH_TABLE') {
      return null;
    }
    throw err;
  }
}

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {{ id: number, codigoCliente?: string, numeroInterno?: number }[]} processos
 */
export async function excluirProcessosPorIds(conn, processos) {
  const lista = processos
    .filter((p) => Number.isFinite(p.id) && p.id >= 1)
    .sort((a, b) => a.id - b.id);
  if (!lista.length) return { excluidos: 0 };

  const ids = lista.map((p) => p.id);
  const ph = placeholders(ids.length);

  const paresCalculo = lista.filter((p) => p.codigoCliente && Number.isFinite(p.numeroInterno));
  if (paresCalculo.length) {
    const tuplas = paresCalculo.map(() => '(TRIM(?), ?)').join(', ');
    const paramsCalculo = paresCalculo.flatMap((p) => [p.codigoCliente, p.numeroInterno]);
    await conn.query(
      `DELETE FROM calculo_rodada WHERE (TRIM(codigo_cliente), numero_processo) IN (${tuplas})`,
      paramsCalculo
    );
  }

  const refsAgenda = paresCalculo.map((p) => `${String(p.codigoCliente).trim()}|${p.numeroInterno}`);
  if (refsAgenda.length) {
    const phRef = placeholders(refsAgenda.length);
    await conn.query(
      `DELETE FROM agenda_evento WHERE processo_ref IN (${phRef}) AND origem IN ('processos-audiencia', 'processos-prazo-lembrete')`,
      refsAgenda
    );
  }

  const [pagRows] = await conn.query(`SELECT id FROM pagamento WHERE processo_id IN (${ph})`, ids);
  const pagamentoIds = pagRows.map((r) => Number(r.id)).filter((id) => id >= 1);
  if (pagamentoIds.length) {
    const phPag = placeholders(pagamentoIds.length);
    await execOpcional(
      conn,
      `UPDATE contrato_honorarios_parcela SET pagamento_id = NULL WHERE pagamento_id IN (${phPag})`,
      pagamentoIds
    );
    await execOpcional(conn, `UPDATE demanda_cards SET pagamento_id = NULL WHERE pagamento_id IN (${phPag})`, pagamentoIds);
    await execOpcional(conn, `UPDATE iptu_parcela SET pagamento_id = NULL WHERE pagamento_id IN (${phPag})`, pagamentoIds);
    await execOpcional(
      conn,
      `UPDATE pagamento SET recorrencia_pagamento_origem_id = NULL, substituido_por_pagamento_id = NULL
       WHERE recorrencia_pagamento_origem_id IN (${phPag}) OR substituido_por_pagamento_id IN (${phPag})`,
      [...pagamentoIds, ...pagamentoIds]
    );
    await execOpcional(conn, `DELETE FROM pagamento_historico WHERE pagamento_id IN (${phPag})`, pagamentoIds);
    await execOpcional(conn, `DELETE FROM prestacao_contas_pagamento WHERE pagamento_id IN (${phPag})`, pagamentoIds);
    await conn.query(`DELETE FROM pagamento WHERE id IN (${phPag})`, pagamentoIds);
  }

  await conn.query(
    `UPDATE processo_prazo SET andamento_id = NULL
     WHERE andamento_id IN (SELECT id FROM processo_andamento WHERE processo_id IN (${ph}))`,
    ids
  );
  await conn.query(`DELETE FROM processo_andamento WHERE processo_id IN (${ph})`, ids);
  await conn.query(
    `DELETE chp FROM contrato_honorarios_parcela chp
     INNER JOIN contrato_honorarios ch ON ch.id = chp.contrato_honorarios_id
     WHERE ch.processo_id IN (${ph})`,
    ids
  );
  await conn.query(`DELETE FROM contrato_honorarios WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM financeiro_lancamento WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM financeiro_lancamento_cartao WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM financeiro_regra_classificacao WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM financeiro_recorrencia_descarte WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM financeiro_semelhante_escritorio_descarte WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM publicacoes WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM tarefa_operacional WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM julia_triagem WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM notificacao_destinatario WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM movimentacao_monitorada WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM consulta_processo_execucao WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM agendamento_consulta WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM whatsapp_messages WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM scheduled_whatsapp_messages WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `DELETE FROM imovel_processo WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `UPDATE imovel SET processo_id = NULL WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `UPDATE contrato_locacao SET processo_id = NULL WHERE processo_id IN (${ph})`, ids);
  await execOpcional(conn, `UPDATE imovel_vinculo_locatario SET processo_id = NULL WHERE processo_id IN (${ph})`, ids);
  await conn.query(`DELETE FROM processo_prazo WHERE processo_id IN (${ph})`, ids);
  await conn.query(
    `DELETE ppa FROM processo_parte_advogado ppa
     INNER JOIN processo_parte pp ON pp.id = ppa.processo_parte_id
     WHERE pp.processo_id IN (${ph})`,
    ids
  );
  await conn.query(`DELETE FROM processo_parte WHERE processo_id IN (${ph})`, ids);
  const [del] = await conn.query(`DELETE FROM processo WHERE id IN (${ph})`, ids);
  return { excluidos: del?.affectedRows ?? ids.length };
}

/** @param {unknown[]} arr @param {number} size */
export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
