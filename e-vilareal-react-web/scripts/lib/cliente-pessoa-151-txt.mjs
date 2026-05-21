/**
 * **Pessoa do cadastro Clientes** — txt legado VB `COD.151.1.0` (Gerais, sem nº de processo).
 * Alimenta o campo «Pessoa» no formulário **Clientes** (`POST /api/clientes`).
 *
 * Não confundir com partes do processo (`Proc/…/90.{proc}.NN` e `95.{proc}.NN`) — ver
 * `legado-pessoa-cliente-vs-partes-processo.mjs` e `proc-processo-partes-txt.mjs`.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  centenaPastaClienteHistorico,
  formatCod8,
  pastaNumeroClienteHistorico,
  readOneLineFile,
  SEGMENTO_MIL,
} from './historico-local-txt-paths.mjs';
import { resolverBaseBancoDados } from './gerais-fase-processo-txt.mjs';
import { apagarProcessosDependentesPorIds } from './processos-dropbox-cliente.mjs';
import { resolverPessoaIdCliente } from './vilareal-import-processo-api.mjs';

export const TIPO_PESSOA_CLIENTE = '151.1.0';

/**
 * @param {string} baseBanco
 * @param {number} codNum
 * @returns {string}
 */
export function caminhoArquivoPessoaCliente151(baseBanco, codNum) {
  const cod8 = formatCod8(codNum);
  const cent = centenaPastaClienteHistorico(codNum);
  const pastaCli = pastaNumeroClienteHistorico(codNum);
  return path.join(baseBanco, 'Gerais', SEGMENTO_MIL, String(cent), pastaCli, `${cod8}.${TIPO_PESSOA_CLIENTE}.txt`);
}

/**
 * @param {number} codNum
 * @param {{ baseBanco?: string }} [opts]
 * @returns {{ pessoaId: number | null, arquivo: string | null, textoBruto?: string | null, aviso?: string }}
 */
export function lerNumeroPessoaCliente151Txt(codNum, opts = {}) {
  const baseBanco = opts.baseBanco ?? resolverBaseBancoDados();
  const abs = caminhoArquivoPessoaCliente151(baseBanco, codNum);
  if (!fs.existsSync(abs)) {
    return { pessoaId: null, arquivo: null };
  }

  const textoBruto = readOneLineFile(abs);
  const t = String(textoBruto ?? '').trim();
  if (!t) {
    return { pessoaId: null, arquivo: abs, textoBruto: t, aviso: 'vazio' };
  }

  const n = Number.parseInt(t.replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1) {
    return { pessoaId: null, arquivo: abs, textoBruto: t, aviso: 'valor_invalido' };
  }

  return { pessoaId: n, arquivo: abs, textoBruto: t };
}

/**
 * Remove processos (e dependentes) na pessoa-alvo que colidem em `numero_interno` com a origem.
 * @param {import('mysql2/promise').Connection} conn
 * @param {number} pessoaIdAlvo
 * @param {number} pessoaIdOrigem
 */
async function removerProcessosConflitoNaPessoaAlvo(conn, pessoaIdAlvo, pessoaIdOrigem) {
  const alvo = Math.trunc(Number(pessoaIdAlvo));
  const origem = Math.trunc(Number(pessoaIdOrigem));
  const [conflitos] = await conn.query(
    `SELECT po.numero_interno AS ni FROM processo po
     INNER JOIN processo pn
       ON pn.pessoa_id = ? AND pn.numero_interno = po.numero_interno
     WHERE po.pessoa_id = ?`,
    [origem, alvo]
  );
  const nums = conflitos.map((r) => Number(r.ni)).filter((n) => Number.isFinite(n));
  if (!nums.length) return { removidos: 0, numeros: [] };

  const ph = nums.map(() => '?').join(',');
  const [idsRows] = await conn.query(
    `SELECT id FROM processo WHERE pessoa_id = ? AND numero_interno IN (${ph})`,
    [alvo, ...nums]
  );
  const ids = idsRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
  if (!ids.length) return { removidos: 0, numeros: nums };

  const phIds = ids.map(() => '?').join(',');
  await conn.query(
    `UPDATE processo_prazo SET andamento_id = NULL
     WHERE andamento_id IN (SELECT id FROM processo_andamento WHERE processo_id IN (${phIds}))`,
    ids
  );
  await conn.query(`DELETE FROM processo_andamento WHERE processo_id IN (${phIds})`, ids);
  await conn.query(
    `DELETE ppa FROM processo_parte_advogado ppa
     INNER JOIN processo_parte pp ON pp.id = ppa.processo_parte_id
     WHERE pp.processo_id IN (${phIds})`,
    ids
  );
  await conn.query(`DELETE FROM processo_parte WHERE processo_id IN (${phIds})`, ids);
  await conn.query(`UPDATE imovel SET processo_id = NULL WHERE processo_id IN (${phIds})`, ids);
  const [del] = await conn.query(`DELETE FROM processo WHERE id IN (${phIds})`, ids);
  return { removidos: Number(del.affectedRows ?? 0), numeros: nums };
}

/**
 * Move `processo` e `imovel` de `pessoa_id` antigo para o novo (respeita UK pessoa+numero_interno).
 * @param {import('mysql2/promise').Connection} conn
 * @param {number} pessoaIdAnterior
 * @param {number} pessoaIdNovo
 * @param {{ substituirConflitos?: boolean }} [opts]
 */
export async function migrarDadosPessoaIdMysql(conn, pessoaIdAnterior, pessoaIdNovo, opts = {}) {
  const ant = Math.trunc(Number(pessoaIdAnterior));
  const novo = Math.trunc(Number(pessoaIdNovo));
  if (!Number.isFinite(ant) || !Number.isFinite(novo) || ant < 1 || novo < 1 || ant === novo) {
    return {
      processosMigrados: 0,
      processosConflito: 0,
      imoveisMigrados: 0,
    };
  }

  const [conflitos] = await conn.query(
    `SELECT po.numero_interno AS ni FROM processo po
     INNER JOIN processo pn
       ON pn.pessoa_id = ? AND pn.numero_interno = po.numero_interno
     WHERE po.pessoa_id = ?`,
    [novo, ant]
  );
  const numerosConflito = conflitos.map((r) => Number(r.ni));

  let conflitosRemovidosAlvo = 0;
  if (opts.substituirConflitos && numerosConflito.length > 0) {
    const rem = await removerProcessosConflitoNaPessoaAlvo(conn, novo, ant);
    conflitosRemovidosAlvo = rem.removidos;
  }

  const [updProc] = await conn.query(
    opts.substituirConflitos
      ? `UPDATE processo SET pessoa_id = ? WHERE pessoa_id = ?`
      : `UPDATE processo po
         LEFT JOIN processo pn
           ON pn.pessoa_id = ? AND pn.numero_interno = po.numero_interno
         SET po.pessoa_id = ?
         WHERE po.pessoa_id = ? AND pn.id IS NULL`,
    opts.substituirConflitos ? [novo, ant] : [novo, novo, ant]
  );

  const [updImo] = await conn.query(`UPDATE imovel SET pessoa_id = ? WHERE pessoa_id = ?`, [
    novo,
    ant,
  ]);

  return {
    processosMigrados: Number(updProc.affectedRows ?? 0),
    processosConflito: numerosConflito.length,
    conflitosRemovidosAlvo,
    numerosConflito: numerosConflito.slice(0, 30),
    imoveisMigrados: Number(updImo.affectedRows ?? 0),
  };
}

/**
 * Move processos (só `numero_interno` do cliente nos txt) de outra pessoa para a pessoa-alvo.
 * @param {import('mysql2/promise').Connection} conn
 * @param {number} pessoaIdOrigem
 * @param {number} pessoaIdAlvo
 * @param {number[]} numerosInternos
 */
export async function migrarProcessosNumerosInternosMysql(
  conn,
  pessoaIdOrigem,
  pessoaIdAlvo,
  numerosInternos
) {
  const origem = Math.trunc(Number(pessoaIdOrigem));
  const alvo = Math.trunc(Number(pessoaIdAlvo));
  const nums = [
    ...new Set(
      numerosInternos.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n >= 1)
    ),
  ];
  if (!nums.length || !Number.isFinite(origem) || !Number.isFinite(alvo) || origem < 1 || alvo < 1) {
    return { processosMigrados: 0, processosConflito: 0, imoveisMigrados: 0, numerosConflito: [] };
  }
  if (origem === alvo) {
    return { processosMigrados: 0, processosConflito: 0, imoveisMigrados: 0, numerosConflito: [] };
  }

  const ph = nums.map(() => '?').join(',');
  const [conflitos] = await conn.query(
    `SELECT po.numero_interno AS ni FROM processo po
     INNER JOIN processo pn
       ON pn.pessoa_id = ? AND pn.numero_interno = po.numero_interno
     WHERE po.pessoa_id = ? AND po.numero_interno IN (${ph})`,
    [alvo, origem, ...nums]
  );
  const numerosConflito = conflitos.map((r) => Number(r.ni));

  const [updProc] = await conn.query(
    `UPDATE processo po
     LEFT JOIN processo pn
       ON pn.pessoa_id = ? AND pn.numero_interno = po.numero_interno
     SET po.pessoa_id = ?
     WHERE po.pessoa_id = ? AND po.numero_interno IN (${ph}) AND pn.id IS NULL`,
    [alvo, alvo, origem, ...nums]
  );

  const [updImo] = await conn.query(
    `UPDATE imovel i
     INNER JOIN processo p ON p.id = i.processo_id AND p.pessoa_id = ? AND p.numero_interno IN (${ph})
     SET i.pessoa_id = ?
     WHERE i.pessoa_id = ?`,
    [alvo, ...nums, alvo, origem]
  );

  return {
    processosMigrados: Number(updProc.affectedRows ?? 0),
    processosConflito: numerosConflito.length,
    numerosConflito: numerosConflito.slice(0, 30),
    imoveisMigrados: Number(updImo.affectedRows ?? 0),
  };
}

/**
 * Detecta outra pessoa com muitos processos que partilham nº interno com a alvo (ex.: vínculo antigo 1985)
 * e migra todos os processos dessa pessoa para `pessoaIdAlvo`.
 * @param {import('mysql2/promise').Connection} conn
 * @param {number} pessoaIdAlvo
 * @param {number[]} numerosInternos
 * @param {number} [minTotalProcessos]
 */
export async function reconciliarPessoaOrigemProvavelClienteMysql(
  conn,
  pessoaIdAlvo,
  numerosInternos,
  minTotalProcessos = 10
) {
  const alvo = Math.trunc(Number(pessoaIdAlvo));
  const nums = [
    ...new Set(
      numerosInternos.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n >= 1)
    ),
  ];
  if (!nums.length || !Number.isFinite(alvo) || alvo < 1) {
    return { processosMigrados: 0, processosConflito: 0, imoveisMigrados: 0, pessoasOrigem: [] };
  }

  const ph = nums.map(() => '?').join(',');
  const [candidatos] = await conn.query(
    `SELECT po.pessoa_id AS pid,
            COUNT(DISTINCT po.numero_interno) AS shared,
            (SELECT COUNT(*) FROM processo p2 WHERE p2.pessoa_id = po.pessoa_id) AS total
     FROM processo po
     INNER JOIN processo pt
       ON pt.pessoa_id = ? AND pt.numero_interno IN (${ph}) AND pt.numero_interno = po.numero_interno
     WHERE po.pessoa_id != ?
     GROUP BY po.pessoa_id
     HAVING shared >= 1 AND total >= ?
     ORDER BY total DESC
     LIMIT 1`,
    [alvo, ...nums, alvo, Math.max(1, Math.trunc(minTotalProcessos))]
  );

  /** @type {number[]} */
  const pessoasOrigem = [];
  let total = {
    processosMigrados: 0,
    processosConflito: 0,
    imoveisMigrados: 0,
    numerosConflito: /** @type {number[]} */ ([]),
  };

  for (const row of candidatos) {
    const pid = Number(row.pid);
    if (!Number.isFinite(pid) || pid < 1 || pid === alvo) continue;
    pessoasOrigem.push(pid);
    const m = await migrarDadosPessoaIdMysql(conn, pid, alvo, { substituirConflitos: true });
    total.processosMigrados += m.processosMigrados;
    total.processosConflito += m.processosConflito;
    total.imoveisMigrados += m.imoveisMigrados;
    if (m.numerosConflito?.length) {
      total.numerosConflito = [...total.numerosConflito, ...m.numerosConflito].slice(0, 30);
    }
  }

  return { ...total, pessoasOrigem };
}

/**
 * Atualiza `cliente.pessoa_id` quando a API já tem outro vínculo (legado codigo≈pessoa).
 * @param {import('mysql2/promise').Connection} conn
 * @param {string} cod8
 * @param {number} pessoaIdTxt
 * @param {number[]} [numerosInternos] Nº interno presentes no Dropbox — migração limitada a estes
 */
export async function substituirVinculoClientePessoaMysql(conn, cod8, pessoaIdTxt, numerosInternos = []) {
  const pid = Math.trunc(Number(pessoaIdTxt));
  if (!Number.isFinite(pid) || pid < 1) {
    return { acao: 'ignorado', motivo: 'pessoa_id_invalido' };
  }

  const [rows] = await conn.query(
    'SELECT id, pessoa_id FROM cliente WHERE codigo_cliente = ? LIMIT 1',
    [cod8]
  );
  if (!rows?.length) {
    return { acao: 'sem_linha_cliente', pessoaId: pid };
  }

  const atual = Number(rows[0].pessoa_id);
  if (atual === pid) {
    return { acao: 'ja_ok', pessoaId: pid };
  }

  const [pessoa] = await conn.query('SELECT id FROM pessoa WHERE id = ? LIMIT 1', [pid]);
  if (!pessoa?.length) {
    return { acao: 'pessoa_inexistente', pessoaId: pid, pessoaIdAnterior: atual };
  }

  await conn.query('UPDATE cliente SET pessoa_id = ? WHERE codigo_cliente = ?', [pid, cod8]);

  const nums = [
    ...new Set(
      numerosInternos.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n >= 1)
    ),
  ];
  let migracao = {
    processosMigrados: 0,
    processosConflito: 0,
    conflitosRemovidosAlvo: 0,
    imoveisMigrados: 0,
  };
  if (nums.length > 0) {
    for (const ni of nums) {
      const [dup] = await conn.query(
        `SELECT id FROM processo WHERE pessoa_id = ? AND numero_interno = ? LIMIT 1`,
        [pid, ni]
      );
      if (dup?.length) {
        await apagarProcessosDependentesPorIds(
          conn,
          dup.map((r) => Number(r.id))
        );
      }
    }
    migracao = await migrarProcessosNumerosInternosMysql(conn, atual, pid, nums);
  }

  return {
    acao: 'atualizado_mysql',
    pessoaId: pid,
    pessoaIdAnterior: atual,
    migracao,
  };
}

/**
 * Garante vínculo `codigoCliente` → `pessoaId` (POST ou UPDATE MySQL com `--substituir`).
 *
 * @param {string} baseUrl
 * @param {string} token
 * @param {string} cod8
 * @param {number} pessoaIdTxt
 * @param {Map<string, number>} [cache]
 * @param {{ substituir?: boolean, conn?: import('mysql2/promise').Connection }} [opts]
 */
export async function sincronizarVinculoClientePessoaApi(
  baseUrl,
  token,
  cod8,
  pessoaIdTxt,
  cache = new Map(),
  opts = {}
) {
  const pid = Math.trunc(Number(pessoaIdTxt));
  if (!Number.isFinite(pid) || pid < 1) {
    return { acao: 'ignorado', motivo: 'pessoa_id_invalido' };
  }

  const atual = await resolverPessoaIdCliente(baseUrl, token, cod8, cache);
  if (atual === pid) {
    return { acao: 'ja_ok', pessoaId: pid };
  }
  if (atual != null && atual !== pid) {
    if (opts.substituir && opts.conn) {
      const sub = await substituirVinculoClientePessoaMysql(opts.conn, cod8, pid);
      if (sub.acao === 'atualizado_mysql' || sub.acao === 'ja_ok') {
        cache.set(cod8, pid);
        return sub;
      }
      if (sub.acao === 'pessoa_inexistente') {
        return sub;
      }
      if (sub.acao !== 'sem_linha_cliente') {
        return sub;
      }
      // Sem linha em `cliente` — fallback da API não é vínculo real; segue POST abaixo.
    } else {
      return {
        acao: 'divergente_api',
        pessoaIdApi: atual,
        pessoaIdTxt: pid,
        motivo: 'codigo_ja_vinculado_outra_pessoa',
      };
    }
  }

  const res = await fetch(`${baseUrl}/api/clientes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({ codigoCliente: cod8, pessoaId: pid }),
  });
  const txt = await res.text();
  let body = null;
  try {
    body = txt ? JSON.parse(txt) : null;
  } catch {
    body = null;
  }

  if (res.status === 201 || res.status === 200) {
    cache.set(cod8, pid);
    return {
      acao: res.status === 201 ? 'criado' : 'confirmado',
      pessoaId: pid,
      cliente: body,
    };
  }

  if (res.status === 409 || res.status === 422) {
    return {
      acao: 'rejeitado',
      pessoaIdTxt: pid,
      status: res.status,
      detalhe: txt.slice(0, 300),
    };
  }

  throw new Error(`POST /api/clientes ${cod8}: ${res.status} ${txt.slice(0, 300)}`);
}
