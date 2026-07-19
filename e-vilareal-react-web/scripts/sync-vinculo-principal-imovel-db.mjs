#!/usr/bin/env node
/**
 * Sincroniza vínculo principal Cod.+Proc. no MySQL (conta corrente / reconciliação).
 *
 * Uso:
 *   node scripts/sync-vinculo-principal-imovel-db.mjs --planilha=39 --codigo=00000938 --proc=52
 *
 * MySQL: VILAREAL_MYSQL_* ou SSH (chave ~/.ssh/villareal_vps → root@161.97.175.73).
 */
import './lib/load-vilareal-import-env.mjs';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const out = { planilha: null, codigo: null, proc: null, sshHost: process.env.VILAREAL_VPS_HOST || '161.97.175.73', sshUser: 'root', sshKey: path.join(os.homedir(), '.ssh', 'villareal_vps'), dryRun: false };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--planilha=')) out.planilha = Number(a.split('=')[1]);
    else if (a.startsWith('--codigo=')) out.codigo = String(a.split('=')[1]).trim();
    else if (a.startsWith('--proc=')) out.proc = Number(a.split('=')[1]);
    else if (a.startsWith('--ssh-host=')) out.sshHost = a.split('=')[1];
    else if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

async function resolverIds(conn, codigo, proc) {
  const [clientes] = await conn.query(
    `SELECT id FROM cliente WHERE codigo_cliente = ? LIMIT 1`,
    [codigo],
  );
  if (!clientes?.length) throw new Error(`Cliente não encontrado: ${codigo}`);
  const clienteId = Number(clientes[0].id);
  const [processos] = await conn.query(
    `SELECT id FROM processo WHERE cliente_id = ? AND numero_interno = ? ORDER BY id DESC LIMIT 1`,
    [clienteId, proc],
  );
  if (!processos?.length) throw new Error(`Processo não encontrado: ${codigo}|${proc}`);
  return { processoId: Number(processos[0].id), clienteId };
}

async function resolverImovelContrato(conn, planilha) {
  const [imoveis] = await conn.query(
    `SELECT id, situacao FROM imovel WHERE numero_planilha = ? ORDER BY id`,
    [planilha],
  );
  if (!imoveis?.length) throw new Error(`Nenhum imóvel na planilha ${planilha}`);
  let alvo = imoveis.find((i) => String(i.situacao).toUpperCase() === 'OCUPADO') || imoveis[imoveis.length - 1];
  for (const im of imoveis) {
    const [contratos] = await conn.query(
      `SELECT id FROM contrato_locacao WHERE imovel_id = ? AND UPPER(status) = 'VIGENTE' ORDER BY data_inicio DESC, id DESC LIMIT 1`,
      [im.id],
    );
    if (contratos?.length) {
      alvo = im;
      return { imovelId: Number(im.id), contratoId: Number(contratos[0].id) };
    }
  }
  return { imovelId: Number(alvo.id), contratoId: null };
}

function buildSql(planilha, codigo, proc, processoId, imovelId, contratoId) {
  const obs = `V210 — sincronizado com vínculo principal ${codigo}|${proc}`;
  const stmts = [
    `INSERT INTO imovel_vinculo_processo_principal (numero_planilha, codigo_cliente, numero_interno) VALUES (${planilha}, '${codigo}', ${proc}) ON DUPLICATE KEY UPDATE codigo_cliente='${codigo}', numero_interno=${proc}`,
    contratoId ? `UPDATE contrato_locacao SET processo_id=${processoId} WHERE id=${contratoId}` : null,
    `UPDATE imovel SET processo_id=${processoId} WHERE id=${imovelId}`,
    `INSERT INTO imovel_processo (imovel_id, processo_id, data_inicio, ativo, observacao) SELECT ${imovelId}, ${processoId}, CURDATE(), TRUE, '${obs}' WHERE NOT EXISTS (SELECT 1 FROM imovel_processo WHERE imovel_id=${imovelId} AND processo_id=${processoId})`,
    `UPDATE imovel_processo SET ativo=TRUE, data_fim=NULL, observacao='${obs}' WHERE imovel_id=${imovelId} AND processo_id=${processoId}`,
    `UPDATE imovel_processo SET ativo=FALSE, data_fim=COALESCE(data_fim, CURDATE()) WHERE imovel_id=${imovelId} AND processo_id<>${processoId} AND ativo=TRUE`,
  ].filter(Boolean);
  return stmts;
}

async function executarViaSsh(opts, sqlBundle) {
  const remoteSql = sqlBundle.join(';\n') + ';';
  const args = ['-i', opts.sshKey, '-o', 'IdentitiesOnly=yes', `${opts.sshUser}@${opts.sshHost}`, `mysql -u root -proot vilareal -e ${JSON.stringify(remoteSql)}`];
  const { stdout } = await execFileAsync('ssh', args, { maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.planilha || !opts.codigo || !opts.proc) {
    console.error('Uso: --planilha=N --codigo=00000938 --proc=52');
    process.exit(1);
  }
  const codigo = opts.codigo.padStart(8, '0');

  let conn;
  let mode = 'mysql';
  try {
    conn = await conectarMysqlVilareal();
  } catch {
    mode = 'ssh';
  }

  if (mode === 'mysql') {
    const { processoId } = await resolverIds(conn, codigo, opts.proc);
    const { imovelId, contratoId } = await resolverImovelContrato(conn, opts.planilha);
    const sqls = buildSql(opts.planilha, codigo, opts.proc, processoId, imovelId, contratoId);
    if (opts.dryRun) {
      console.log(sqls.join('\n'));
      await conn.end();
      return;
    }
    for (const sql of sqls) await conn.query(sql);
    await conn.end();
    console.log(`OK planilha ${opts.planilha} → imóvel ${imovelId}, processo ${processoId}${contratoId ? `, contrato ${contratoId}` : ''}`);
    return;
  }

  // SSH: resolve ids inline no SQL (subselect)
  const obs = `sync vínculo principal ${codigo}|${opts.proc}`;
  const sql = `
    SET @cod='${codigo}';
    SET @proc=${opts.proc};
    SET @planilha=${opts.planilha};
    SET @processo_id=(SELECT p.id FROM processo p JOIN cliente c ON c.id=p.cliente_id WHERE c.codigo_cliente=@cod AND p.numero_interno=@proc ORDER BY p.id DESC LIMIT 1);
    SET @imovel_id=(SELECT i.id FROM imovel i WHERE i.numero_planilha=@planilha AND UPPER(i.situacao)='OCUPADO' ORDER BY i.id DESC LIMIT 1);
    SET @imovel_id=IFNULL(@imovel_id,(SELECT i.id FROM imovel i WHERE i.numero_planilha=@planilha ORDER BY i.id DESC LIMIT 1));
    SET @contrato_id=(SELECT c.id FROM contrato_locacao c WHERE c.imovel_id=@imovel_id AND UPPER(c.status)='VIGENTE' ORDER BY c.data_inicio DESC, c.id DESC LIMIT 1);
    INSERT INTO imovel_vinculo_processo_principal (numero_planilha, codigo_cliente, numero_interno) VALUES (@planilha, @cod, @proc) ON DUPLICATE KEY UPDATE codigo_cliente=@cod, numero_interno=@proc;
    UPDATE contrato_locacao SET processo_id=@processo_id WHERE id=@contrato_id;
    UPDATE imovel SET processo_id=@processo_id WHERE id=@imovel_id;
    INSERT INTO imovel_processo (imovel_id, processo_id, data_inicio, ativo, observacao) SELECT @imovel_id, @processo_id, CURDATE(), TRUE, '${obs}' WHERE @imovel_id IS NOT NULL AND @processo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM imovel_processo WHERE imovel_id=@imovel_id AND processo_id=@processo_id);
    UPDATE imovel_processo SET ativo=TRUE, data_fim=NULL WHERE imovel_id=@imovel_id AND processo_id=@processo_id;
    UPDATE imovel_processo SET ativo=FALSE, data_fim=COALESCE(data_fim, CURDATE()) WHERE imovel_id=@imovel_id AND processo_id<>@processo_id AND ativo=TRUE;
    SELECT @planilha AS planilha, @imovel_id AS imovel_id, @contrato_id AS contrato_id, @processo_id AS processo_id;
  `;
  if (opts.dryRun) {
    console.log(sql);
    return;
  }
  const out = await executarViaSsh(opts, [sql]);
  console.log(out.trim());
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
