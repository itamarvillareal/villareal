#!/usr/bin/env node
/**
 * deduplicar-andamentos-processo.mjs
 * ───────────────────────────────────
 * Varre `processo_andamento` (histórico do processo) e remove duplicados gerados por
 * reimportações, com várias camadas de análise antes de apagar qualquer linha.
 *
 * ESCOPO OBRIGATÓRIO (cliente + processo):
 *   A análise compara andamentos **somente dentro do mesmo `processo_id`** (mesmo cliente e mesmo
 *   número interno do processo). Nunca agrupa nem apaga com base em linhas de processos diferentes,
 *   mesmo que o texto e a data sejam iguais noutro processo do mesmo cliente.
 *
 * ALCANCE (banco inteiro):
 *   Sem `--cliente` nem `--processo-id`, varre **todos** os andamentos da base ligada (VPS ou local).
 *   Use filtros só para testes pontuais (ex.: cliente 473 / processo 100).
 *
 * CENÁRIO PRINCIPAL — duplicata entre origens de import:
 *   O mesmo movimento pode existir 2× no mesmo processo com `origem` diferente, por reimportações
 *   com `--origem=IMPORT_PLANILHA` e depois `--origem=IMPORT_PLANILHA_376_499` (sem apagar a origem
 *   anterior). Isso gera pares como Inf. 64 e 63 na UI. Este script agrupa por conteúdo (data+título),
 *   **ignora `origem` na chave**, marca alerta ORIGENS_DIFERENTES e mantém a linha de maior prioridade
 *   (de preferência IMPORT_PLANILHA). Não corrige `usuario_id` vazio — é outro tema.
 *
 * Camadas (da mais segura à mais ampla):
 *   BRUTA   — mesmo `movimento_em` + mesmo `titulo` literal na BD
 *   ESTRITA — mesma chave do import `--apenas-novos` (data UTC ao segundo + título normalizado)
 *   DATA    — mesmo dia (UTC) + título normalizado (só se detalhe normalizado também coincidir)
 *
 * Regras de segurança:
 *   - Por defeito: apenas relatório (--dry-run); use --executar para DELETE real
 *   - Mantém 1 registo por grupo (maior pontuação: prazo vinculado > usuário > detalhe > id menor)
 *   - Reaponta `processo_prazo.andamento_id` para o registo mantido antes de apagar duplicados
 *   - Não apaga se títulos normalizados diferem dentro do grupo (exceto camada BRUTA)
 *   - Grupos com distância de título > limiar vão só para relatório "suspeitos" (nunca apagam)
 *   - Transacção por processo (mysql2); confirmação extra: --confirmar=APAGAR-DUPLICADOS
 *
 * Uso:
 *   node scripts/deduplicar-andamentos-processo.mjs
 *   node scripts/deduplicar-andamentos-processo.mjs --cliente=728
 *   node scripts/deduplicar-andamentos-processo.mjs --processo-id=12345 --executar --confirmar=APAGAR-DUPLICADOS
 *   VILAREAL_MYSQL_PORT=3308 VILAREAL_MYSQL_PASSWORD='***' node scripts/deduplicar-andamentos-processo.mjs --executar --confirmar=APAGAR-DUPLICADOS
 *
 * npm (na pasta e-vilareal-react-web): npm run dedupe:andamentos-processo
 *
 * Envs MySQL: VILAREAL_MYSQL_HOST, PORT, USER, PASSWORD, DATABASE, DOCKER (opcional)
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  assertMesmoProcessoId,
  chaveAndamentoBruta,
  chaveAndamentoEstrita,
  chaveAndamentoPorDataDia,
  chaveBucketPorProcesso,
  chaveDetalheParaDedupe,
  chaveTituloParaDedupe,
  classificarMotivoDuplicado,
  distanciaTituloNormalizada,
  isOrigemImportPlanilha,
  pontuarCandidatoKeeper,
} from './lib/chaves-dedupe-andamento.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';

const CAMADAS_ORDEM = ['BRUTA', 'ESTRITA', 'DATA'];
const CONFIRMAR_TOKEN = 'APAGAR-DUPLICADOS';
const LIMIAR_TITULO_SUSPEITO = 0.08;

/** @typedef {'BRUTA' | 'ESTRITA' | 'DATA'} CamadaDedupe */

/**
 * @typedef {object} AndamentoRow
 * @property {number} id
 * @property {number} processo_id
 * @property {string | Date | null} movimento_em
 * @property {string} titulo
 * @property {string | null} detalhe
 * @property {string} origem
 * @property {number | null} usuario_id
 * @property {string | null} importacao_id
 * @property {number} prazo_refs
 * @property {string | null} codigo_cliente
 * @property {number} numero_interno
 */

/**
 * @param {AndamentoRow[]} rows
 * @param {number} processoId
 */
function metaEscopoProcesso(rows, processoId) {
  assertMesmoProcessoId(rows, processoId);
  const r0 = rows[0];
  return {
    tipo: 'PROCESSO_UNICO',
    processoId: Number(processoId),
    codigoCliente: r0?.codigo_cliente ?? null,
    numeroInterno: r0?.numero_interno ?? null,
    regra:
      'Comparação apenas entre andamentos deste processo_id; nunca entre processos diferentes.',
  };
}

function parseArgs(argv) {
  /** @type {Record<string, string | boolean | number>} */
  const out = {
    dryRun: true,
    executar: false,
    confirmar: '',
    relatorio: '',
    cliente: '',
    processoId: 0,
    camadas: 'BRUTA,ESTRITA',
    limiteProcessos: 0,
    verbose: false,
    incluirSuspeitos: false,
    exigirDetalheIgual: true,
    minGrupo: 2,
  };
  for (const raw of argv) {
    if (raw === '--executar') {
      out.executar = true;
      out.dryRun = false;
    } else if (raw === '--dry-run') out.dryRun = true;
    else if (raw === '--verbose' || raw === '-v') out.verbose = true;
    else if (raw === '--incluir-suspeitos') out.incluirSuspeitos = true;
    else if (raw === '--ignorar-detalhe-diferente') out.exigirDetalheIgual = false;
    else if (raw.startsWith('--confirmar=')) out.confirmar = raw.slice('--confirmar='.length);
    else if (raw.startsWith('--relatorio=')) out.relatorio = raw.slice('--relatorio='.length);
    else if (raw.startsWith('--cliente=')) out.cliente = raw.slice('--cliente='.length);
    else if (raw.startsWith('--processo-id=')) {
      out.processoId = Number(raw.slice('--processo-id='.length));
    } else if (raw.startsWith('--camadas=')) out.camadas = raw.slice('--camadas='.length);
    else if (raw.startsWith('--limite-processos=')) {
      out.limiteProcessos = Number(raw.slice('--limite-processos='.length));
    } else if (raw.startsWith('--min-grupo=')) {
      out.minGrupo = Number(raw.slice('--min-grupo='.length));
    } else if (raw === '--help' || raw === '-h') {
      imprimirAjuda();
      process.exit(0);
    }
  }
  return out;
}

function imprimirAjuda() {
  console.log(`deduplicar-andamentos-processo.mjs — manutenção de duplicados em processo_andamento

Alcance: por defeito analisa TODO o banco. Filtros opcionais: --cliente=473 --processo-id=N

Escopo: duplicados são detectados SOMENTE dentro do mesmo processo (processo_id).
        Dois processos do mesmo cliente com o mesmo texto/data NÃO são comparados entre si.

Cenário típico: mesmo movimento com IMPORT_PLANILHA + IMPORT_PLANILHA_* (reimportação).
                A origem não impede a detecção; o relatório marca REIMPORTACAO_ENTRE_ORIGENS.

Opções:
  --dry-run              Só relatório (defeito se omitir --executar)
  --executar             Aplica DELETE (requer --confirmar=${CONFIRMAR_TOKEN})
  --confirmar=TOKEN      Confirmação explícita contra apagamento acidental
  --relatorio=caminho    JSON com grupos e estatísticas
  --cliente=728          Limita a um código cliente (8 dígitos)
  --processo-id=N        Limita a um processo
  --camadas=BRUTA,ESTRITA  Camadas a aplicar (DATA opcional, mais ampla)
  --limite-processos=N   Para testes em subconjunto
  --min-grupo=2          Tamanho mínimo do grupo para agir
  --ignorar-detalhe-diferente  Permite DATA/ESTRITA mesmo com detalhe distinto
  --incluir-suspeitos    Inclui pares quase-iguais no relatório (nunca apaga)
  --verbose              Log por processo

MySQL: VILAREAL_MYSQL_* ou VILAREAL_MYSQL_DOCKER=vilareal-db
`);
}

function normalizarCodigoCliente8(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim().replace(/\D/g, '');
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return String(n).padStart(8, '0');
}

/** @param {CamadaDedupe} camada @param {AndamentoRow} row */
function chavePorCamada(camada, row) {
  switch (camada) {
    case 'BRUTA':
      return chaveAndamentoBruta(row.movimento_em, row.titulo);
    case 'ESTRITA':
      return chaveAndamentoEstrita(row.movimento_em, row.titulo);
    case 'DATA':
      return chaveAndamentoPorDataDia(row.titulo, row.movimento_em);
    default:
      throw new Error(`Camada desconhecida: ${camada}`);
  }
}

/**
 * @param {AndamentoRow[]} rows
 * @param {CamadaDedupe} camada
 * @param {boolean} exigirDetalheIgual
 */
function analisarGrupoDuplicado(rows, camada, exigirDetalheIgual, processoId) {
  if (rows.length < 2) return null;
  assertMesmoProcessoId(rows, processoId);

  const titulosNorm = new Set(rows.map((r) => chaveTituloParaDedupe(r.titulo)));
  const detalhesNorm = new Set(rows.map((r) => chaveDetalheParaDedupe(r.detalhe)));

  /** @type {string[]} */
  const alertas = [];

  if (titulosNorm.size > 1 && camada !== 'BRUTA') {
    alertas.push('TITULOS_NORMALIZADOS_DIFERENTES');
    return { acao: 'IGNORAR', alertas, keeper: null, remover: [], rows };
  }

  if (exigirDetalheIgual && detalhesNorm.size > 1 && camada !== 'BRUTA') {
    alertas.push('DETALHES_DIFERENTES');
    return { acao: 'IGNORAR', alertas, keeper: null, remover: [], rows };
  }

  const origens = [...new Set(rows.map((r) => String(r.origem ?? '').trim()).filter(Boolean))];
  const motivo = classificarMotivoDuplicado(rows);
  if (origens.length > 1) {
    alertas.push('ORIGENS_DIFERENTES');
    if (motivo.motivo === 'REIMPORTACAO_ENTRE_ORIGENS') {
      alertas.push('REIMPORTACAO_ENTRE_ORIGENS');
    }
  }

  const ordenados = [...rows].sort(
    (a, b) => pontuarCandidatoKeeper(b) - pontuarCandidatoKeeper(a) || a.id - b.id
  );
  const keeper = ordenados[0];
  const remover = ordenados.slice(1);

  let maxDist = 0;
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      maxDist = Math.max(maxDist, distanciaTituloNormalizada(rows[i].titulo, rows[j].titulo));
    }
  }
  if (maxDist > LIMIAR_TITULO_SUSPEITO && camada !== 'BRUTA') {
    alertas.push(`TITULO_SIMILAR_MAX=${maxDist.toFixed(4)}`);
  }

  return {
    acao: 'REMOVER_DUPLICADOS',
    alertas,
    keeper,
    remover,
    rows,
    maxDistTitulo: maxDist,
    motivo,
    origens,
  };
}

/**
 * @param {Map<number, AndamentoRow[]>} porProcesso
 * @param {CamadaDedupe[]} camadasAtivas
 * @param {ReturnType<typeof parseArgs>} opts
 */
function montarPlano(porProcesso, camadasAtivas, opts) {
  /** @type {Map<number, Set<number>>} */
  const idsParaRemoverGlobal = new Map();
  /** @type {object[]} */
  const gruposRelatorio = [];
  /** @type {object[]} */
  const suspeitos = [];
  const stats = {
    processosAnalisados: 0,
    andamentosLidos: 0,
    gruposDuplicados: 0,
    gruposIgnorados: 0,
    gruposReimportacaoEntreOrigens: 0,
    andamentosMarcadosRemover: 0,
    prazosReapontados: 0,
  };

  for (const [processoId, rows] of porProcesso) {
    stats.processosAnalisados += 1;
    stats.andamentosLidos += rows.length;
    if (!rows.length) continue;
    assertMesmoProcessoId(rows, processoId);
    const escopo = metaEscopoProcesso(rows, processoId);

    /** @type {Set<number>} */
    const jaMarcadosNesteProcesso = new Set();

    for (const camada of camadasAtivas) {
      /** @type {Map<string, AndamentoRow[]>} */
      const buckets = new Map();
      for (const row of rows) {
        if (jaMarcadosNesteProcesso.has(row.id)) continue;
        if (Number(row.processo_id) !== Number(processoId)) {
          throw new Error(
            `Andamento #${row.id} com processo_id=${row.processo_id} fora do lote ${processoId}`
          );
        }
        const k = chaveBucketPorProcesso(processoId, chavePorCamada(camada, row));
        const arr = buckets.get(k) || [];
        arr.push(row);
        buckets.set(k, arr);
      }

      for (const [chave, grupo] of buckets) {
        if (grupo.length < opts.minGrupo) continue;

        const analise = analisarGrupoDuplicado(grupo, camada, opts.exigirDetalheIgual, processoId);
        if (!analise) continue;

        if (
          analise.maxDistTitulo != null &&
          analise.maxDistTitulo > LIMIAR_TITULO_SUSPEITO &&
          camada !== 'BRUTA'
        ) {
          suspeitos.push({
            escopo,
            camada,
            chave,
            maxDistTitulo: analise.maxDistTitulo,
            ids: grupo.map((r) => r.id),
            alertas: analise.alertas,
          });
          if (!opts.incluirSuspeitos) continue;
        }

        if (analise.acao === 'IGNORAR') {
          stats.gruposIgnorados += 1;
          gruposRelatorio.push({
            escopo,
            camada,
            chave,
            acao: 'IGNORAR',
            alertas: analise.alertas,
            ids: grupo.map((r) => r.id),
          });
          continue;
        }

        stats.gruposDuplicados += 1;
        if (analise.motivo?.motivo === 'REIMPORTACAO_ENTRE_ORIGENS') {
          stats.gruposReimportacaoEntreOrigens += 1;
        }
        const removerIds = analise.remover.map((r) => r.id);
        for (const id of removerIds) {
          if (!jaMarcadosNesteProcesso.has(id)) {
            jaMarcadosNesteProcesso.add(id);
            const set = idsParaRemoverGlobal.get(processoId) || new Set();
            set.add(id);
            idsParaRemoverGlobal.set(processoId, set);
            stats.andamentosMarcadosRemover += 1;
          }
        }

        gruposRelatorio.push({
          escopo,
          camada,
          chave,
          acao: 'REMOVER_DUPLICADOS',
          motivo: analise.motivo,
          origens: analise.origens,
          manter: resumoRow(analise.keeper),
          remover: analise.remover.map(resumoRow),
          alertas: analise.alertas,
        });
      }
    }
  }

  return { idsParaRemoverGlobal, gruposRelatorio, suspeitos, stats };
}

/** @param {AndamentoRow | null | undefined} r */
function resumoRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    movimento_em: r.movimento_em,
    titulo: r.titulo?.slice(0, 120),
    detalhe: r.detalhe ? String(r.detalhe).slice(0, 80) : null,
    origem: r.origem,
    origemImportPlanilha: isOrigemImportPlanilha(r.origem),
    usuario_id: r.usuario_id,
    prazo_refs: r.prazo_refs,
  };
}

/** Estimativa SQL: duplicatas BRUTAS no mesmo processo (qualquer origem). */
async function contarDuplicatasBrutasSql(conn) {
  const [rows] = await conn.query(`
    SELECT
      COUNT(*) AS grupos,
      COALESCE(SUM(cnt - 1), 0) AS linhas_a_remover
    FROM (
      SELECT processo_id, movimento_em, titulo, COUNT(*) AS cnt
      FROM processo_andamento
      GROUP BY processo_id, movimento_em, titulo
      HAVING COUNT(*) > 1
    ) t
  `);
  const r = /** @type {Record<string, unknown>} */ (rows[0] ?? {});
  return { grupos: Number(r.grupos ?? 0), linhasARemover: Number(r.linhas_a_remover ?? 0) };
}

/** Pares com mesma chave BRUTA mas origens distintas (cenário reimportação). */
async function contarDuplicatasEntreOrigensSql(conn) {
  const [rows] = await conn.query(`
    SELECT COUNT(*) AS grupos
    FROM (
      SELECT processo_id, movimento_em, titulo
      FROM processo_andamento
      GROUP BY processo_id, movimento_em, titulo
      HAVING COUNT(*) > 1 AND COUNT(DISTINCT origem) > 1
    ) t
  `);
  return Number(/** @type {Record<string, unknown>} */ (rows[0] ?? {}).grupos ?? 0);
}

/** @param {import('mysql2/promise').Connection} conn @param {ReturnType<typeof parseArgs>} opts */
async function carregarAndamentos(conn, opts) {
  /** @type {unknown[]} */
  const params = [];
  let where = '1=1';
  const cod8 = normalizarCodigoCliente8(opts.cliente);
  if (cod8) {
    where += ' AND c.codigo_cliente = ?';
    params.push(cod8);
  }
  if (opts.processoId > 0) {
    where += ' AND a.processo_id = ?';
    params.push(opts.processoId);
  }

  const sql = `
    SELECT
      a.id,
      a.processo_id,
      a.movimento_em,
      a.titulo,
      a.detalhe,
      a.origem,
      a.usuario_id,
      a.importacao_id,
      p.numero_interno,
      c.codigo_cliente,
      (SELECT COUNT(*) FROM processo_prazo pp WHERE pp.andamento_id = a.id) AS prazo_refs
    FROM processo_andamento a
    INNER JOIN processo p ON p.id = a.processo_id
    LEFT JOIN (
      SELECT pessoa_id, MIN(codigo_cliente) AS codigo_cliente
      FROM cliente
      GROUP BY pessoa_id
    ) c ON c.pessoa_id = p.pessoa_id
    WHERE ${where}
    ORDER BY c.codigo_cliente, p.numero_interno, a.processo_id, a.movimento_em, a.id
  `;

  const [rows] = await conn.query(sql, params);
  /** @type {Map<number, AndamentoRow[]>} */
  const porProcesso = new Map();
  for (const raw of /** @type {Record<string, unknown>[]} */ (rows)) {
    const row = {
      id: Number(raw.id),
      processo_id: Number(raw.processo_id),
      movimento_em: raw.movimento_em,
      titulo: String(raw.titulo ?? ''),
      detalhe: raw.detalhe == null ? null : String(raw.detalhe),
      origem: String(raw.origem ?? ''),
      usuario_id: raw.usuario_id == null ? null : Number(raw.usuario_id),
      importacao_id: raw.importacao_id == null ? null : String(raw.importacao_id),
      prazo_refs: Number(raw.prazo_refs ?? 0),
      codigo_cliente: raw.codigo_cliente == null ? null : String(raw.codigo_cliente),
      numero_interno: Number(raw.numero_interno ?? 0),
    };
    if (cod8 && row.codigo_cliente && row.codigo_cliente !== cod8) {
      throw new Error(
        `Andamento #${row.id}: codigo_cliente ${row.codigo_cliente} não corresponde ao filtro ${cod8}`
      );
    }
    const list = porProcesso.get(row.processo_id) || [];
    const ja = list.some((x) => x.id === row.id);
    if (ja) {
      throw new Error(
        `Andamento #${row.id} duplicado na leitura (processo ${row.processo_id}) — verifique JOINs SQL.`
      );
    }
    list.push(row);
    porProcesso.set(row.processo_id, list);
  }
  return porProcesso;
}

/**
 * Auditoria final: cada grupo declara um único processo_id no escopo.
 * @param {object[]} gruposRelatorio
 */
function auditarEscopoRelatorio(gruposRelatorio) {
  for (const g of gruposRelatorio) {
    const pid = g.escopo?.processoId;
    if (pid == null || !Number.isFinite(Number(pid))) {
      throw new Error('Relatório sem escopo.processoId — abortado por segurança.');
    }
    if (g.escopo?.tipo !== 'PROCESSO_UNICO') {
      throw new Error(`Escopo inválido no grupo: ${g.escopo?.tipo}`);
    }
    if (!String(g.chave || '').startsWith(`proc:${pid}|`)) {
      throw new Error(
        `Chave de bucket "${g.chave}" não pertence ao processo ${pid} — possível mistura entre processos.`
      );
    }
  }
}

/**
 * @param {import('mysql2/promise').Connection} conn
 * @param {Map<number, Set<number>>} plano
 * @param {object[]} gruposRelatorio
 */
async function executarPlano(conn, plano, gruposRelatorio) {
  let prazosReapontados = 0;
  let andamentosApagados = 0;

  /** @type {Map<number, number>} id duplicado → keeper */
  const mapaReapontar = new Map();
  for (const g of gruposRelatorio) {
    if (g.acao !== 'REMOVER_DUPLICADOS' || !g.manter) continue;
    const keeperId = g.manter.id;
    for (const r of g.remover || []) {
      mapaReapontar.set(r.id, keeperId);
    }
  }

  for (const [processoId, idsSet] of plano) {
    const ids = [...idsSet];
    if (!ids.length) continue;

    await conn.beginTransaction();
    try {
      for (const dupId of ids) {
        const keeperId = mapaReapontar.get(dupId);
        if (!keeperId) continue;
        const [res] = await conn.query(
          `UPDATE processo_prazo SET andamento_id = ? WHERE andamento_id = ? AND processo_id = ?`,
          [keeperId, dupId, processoId]
        );
        prazosReapontados += Number(
          /** @type {{ affectedRows?: number }} */ (res).affectedRows ?? 0
        );
      }

      const placeholders = ids.map(() => '?').join(',');
      const [del] = await conn.query(
        `DELETE FROM processo_andamento WHERE processo_id = ? AND id IN (${placeholders})`,
        [processoId, ...ids]
      );
      andamentosApagados += Number(/** @type {{ affectedRows?: number }} */ (del).affectedRows ?? 0);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw new Error(`Falha no processo ${processoId}: ${/** @type {Error} */ (e).message}`);
    }
  }

  return { prazosReapontados, andamentosApagados };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const camadasAtivas = String(opts.camadas)
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => CAMADAS_ORDEM.includes(/** @type {CamadaDedupe} */ (c)));

  if (!camadasAtivas.length) {
    console.error(`Camadas inválidas. Use: ${CAMADAS_ORDEM.join(', ')}`);
    process.exit(1);
  }

  if (opts.executar && opts.confirmar !== CONFIRMAR_TOKEN) {
    console.error(
      `Para executar DELETE, passe --confirmar=${CONFIRMAR_TOKEN} (além de --executar).`
    );
    process.exit(1);
  }

  const conn = await conectarMysqlVilareal();
  const inicio = Date.now();

  try {
    console.log(
      `[dedupe] Modo: ${opts.dryRun ? 'DRY-RUN (sem alterações)' : 'EXECUÇÃO REAL'} | Camadas: ${camadasAtivas.join(', ')}`
    );

    let porProcesso = await carregarAndamentos(conn, opts);

    if (opts.limiteProcessos > 0) {
      const limitado = new Map();
      let n = 0;
      for (const [pid, rows] of porProcesso) {
        if (n >= opts.limiteProcessos) break;
        limitado.set(pid, rows);
        n += 1;
      }
      porProcesso = limitado;
      console.log(`[dedupe] Limite: ${opts.limiteProcessos} processo(s)`);
    }

    const { idsParaRemoverGlobal, gruposRelatorio, suspeitos, stats } = montarPlano(
      porProcesso,
      /** @type {CamadaDedupe[]} */ (camadasAtivas),
      opts
    );

    auditarEscopoRelatorio(gruposRelatorio);

    const validacaoSql = await contarDuplicatasBrutasSql(conn);
    const gruposEntreOrigensSql = await contarDuplicatasEntreOrigensSql(conn);

    const relatorio = {
      script: 'deduplicar-andamentos-processo.mjs',
      geradoEm: new Date().toISOString(),
      modo: opts.dryRun ? 'dry-run' : 'executar',
      escopoAnalise:
        'Duplicados avaliados apenas dentro de cada processo_id (cliente + número interno); nunca entre processos diferentes.',
      cenarioReimportacao:
        'Detecta o mesmo movimento gravado com origens IMPORT_PLANILHA distintas (ex.: IMPORT_PLANILHA vs IMPORT_PLANILHA_376_499) no mesmo processo.',
      validacaoSql: {
        gruposBrutosMesmoProcesso: validacaoSql.grupos,
        linhasExcedentesBrutas: validacaoSql.linhasARemover,
        gruposComOrigensDistintas: gruposEntreOrigensSql,
      },
      camadas: camadasAtivas,
      opcoes: {
        cliente: opts.cliente || null,
        processoId: opts.processoId || null,
        exigirDetalheIgual: opts.exigirDetalheIgual,
      },
      estatisticas: stats,
      suspeitos: suspeitos.slice(0, 500),
      grupos: gruposRelatorio.slice(0, 5000),
      totalGruposRelatorio: gruposRelatorio.length,
      totalSuspeitos: suspeitos.length,
    };

    const relPath =
      opts.relatorio ||
      path.join(
        process.cwd(),
        `relatorio-dedupe-andamentos-${opts.dryRun ? 'dry-run' : 'exec'}-${Date.now()}.json`
      );
    fs.writeFileSync(relPath, JSON.stringify(relatorio, null, 2), 'utf8');

    console.log(`[dedupe] Processos analisados: ${stats.processosAnalisados}`);
    console.log(`[dedupe] Andamentos lidos: ${stats.andamentosLidos}`);
    console.log(`[dedupe] Grupos duplicados (ação): ${stats.gruposDuplicados}`);
    console.log(
      `[dedupe]   └─ reimportação entre origens (IMPORT_PLANILHA*): ${stats.gruposReimportacaoEntreOrigens}`
    );
    console.log(`[dedupe] Grupos ignorados (segurança): ${stats.gruposIgnorados}`);
    console.log(
      `[dedupe] Validação SQL: ${validacaoSql.grupos} grupos brutos, ${gruposEntreOrigensSql} com origens distintas`
    );
    console.log(`[dedupe] Andamentos a remover: ${stats.andamentosMarcadosRemover}`);
    console.log(`[dedupe] Pares suspeitos (só relatório): ${suspeitos.length}`);
    console.log(`[dedupe] Relatório: ${relPath}`);

    if (opts.verbose && stats.gruposDuplicados > 0) {
      const amostra = gruposRelatorio.filter((g) => g.acao === 'REMOVER_DUPLICADOS').slice(0, 5);
      for (const g of amostra) {
        const e = g.escopo;
        console.log(
          `  cliente ${e?.codigoCliente} proc#${e?.numeroInterno} (id ${e?.processoId}) [${g.camada}] manter #${g.manter?.id} apagar ${(g.remover || []).map((r) => r.id).join(',')}`
        );
      }
    }

    if (!opts.dryRun) {
      if (stats.andamentosMarcadosRemover === 0) {
        console.log('[dedupe] Nada a apagar.');
      } else {
        const { prazosReapontados, andamentosApagados } = await executarPlano(
          conn,
          idsParaRemoverGlobal,
          gruposRelatorio
        );
        console.log(`[dedupe] Prazos reapontados: ${prazosReapontados}`);
        console.log(`[dedupe] Andamentos apagados: ${andamentosApagados}`);
      }
    } else {
      console.log(
        `[dedupe] Dry-run concluído. Para aplicar: --executar --confirmar=${CONFIRMAR_TOKEN}`
      );
    }

    console.log(`[dedupe] Tempo: ${((Date.now() - inicio) / 1000).toFixed(1)}s`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[dedupe] Erro:', err.message || err);
  process.exit(1);
});
