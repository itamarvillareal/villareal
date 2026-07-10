#!/usr/bin/env node
/**
 * Audita processo.audiencia_* vs agenda_evento (origem processos-audiencia)
 * e opcionalmente sincroniza via API.
 *
 * Uso:
 *   node scripts/auditar-sincronizar-audiencias-agenda.mjs
 *   VILAREAL_IMPORT_SENHA='…' node scripts/auditar-sincronizar-audiencias-agenda.mjs --aplicar
 */
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { loginObterToken } from './lib/agenda-api-aplicar.mjs';

const args = process.argv.slice(2);
const aplicar = args.includes('--aplicar');
const baseUrl = process.env.VILAREAL_API_BASE || 'http://localhost:8080';
const login = process.env.VILAREAL_IMPORT_LOGIN || 'itamar';
const senha = process.env.VILAREAL_IMPORT_SENHA || '';

function padCodigo(raw) {
  const t = String(raw ?? '').trim().replace(/\s+/g, '');
  if (!t || !/^\d+$/.test(t)) return t;
  return t.padStart(8, '0');
}

function montarRef(codigoCliente, numeroInterno) {
  const cod = padCodigo(codigoCliente);
  const n = Number(numeroInterno);
  if (!cod || !Number.isFinite(n) || n < 1) return null;
  return `${cod}|${Math.floor(n)}`;
}

async function auditar(conn) {
  const [processos] = await conn.query(`
    SELECT p.id, p.numero_interno, c.codigo_cliente, p.audiencia_data, p.audiencia_hora,
           LEFT(p.audiencia_tipo, 60) AS audiencia_tipo
    FROM processo p
    JOIN cliente c ON c.id = p.cliente_id
    WHERE p.ativo = 1 AND p.audiencia_data IS NOT NULL
    ORDER BY p.audiencia_data, p.id
  `);

  const [eventos] = await conn.query(`
    SELECT processo_ref, usuario_id, data_evento, hora_evento
    FROM agenda_evento
    WHERE origem = 'processos-audiencia' AND processo_ref IS NOT NULL
  `);

  const [colaboradores] = await conn.query(`
    SELECT id FROM usuarios WHERE tipo = 'HUMANO' AND ativo = 1
  `);
  const numColab = colaboradores.length;

  const porRef = new Map();
  for (const ev of eventos) {
    const ref = String(ev.processo_ref ?? '').trim();
    if (!ref) continue;
    if (!porRef.has(ref)) porRef.set(ref, new Set());
    porRef.get(ref).add(String(ev.usuario_id));
  }

  const faltando = [];
  const incompletos = [];
  for (const p of processos) {
    const ref = montarRef(p.codigo_cliente, p.numero_interno);
    if (!ref) {
      faltando.push({ ...p, ref: null, motivo: 'sem processo_ref' });
      continue;
    }
    const usuarios = porRef.get(ref);
    if (!usuarios || usuarios.size === 0) {
      faltando.push({ ...p, ref, motivo: 'sem evento na agenda' });
      continue;
    }
    if (usuarios.size < numColab) {
      incompletos.push({ ...p, ref, usuarios: usuarios.size, esperado: numColab });
    }
  }

  const futuras = processos.filter((p) => {
    const d = String(p.audiencia_data ?? '').slice(0, 10);
    return d >= '2026-07-10';
  });

  return {
    numColab,
    totalProcessos: processos.length,
    totalEventos: eventos.length,
    refsDistintas: porRef.size,
    faltando,
    incompletos,
    futuras: futuras.length,
  };
}

function imprimirRelatorio(r) {
  console.log('\n=== Auditoria audiências × agenda ===');
  console.log(`Colaboradores ativos: ${r.numColab}`);
  console.log(`Processos com audiência: ${r.totalProcessos}`);
  console.log(`Eventos agenda (processos-audiencia): ${r.totalEventos}`);
  console.log(`Processos distintos na agenda: ${r.refsDistintas}`);
  console.log(`Esperado (processos × colaboradores): ${r.totalProcessos * r.numColab}`);
  console.log(`Sem espelho na agenda: ${r.faltando.length}`);
  console.log(`Espelho incompleto (< ${r.numColab} usuários): ${r.incompletos.length}`);
  console.log(`Audiências hoje ou futuras (>= 2026-07-10): ${r.futuras}`);

  if (r.faltando.length) {
    console.log('\n--- Ausentes na agenda (até 15) ---');
    for (const row of r.faltando.slice(0, 15)) {
      console.log(
        `  proc#${row.id} ref=${row.ref ?? '—'} ${row.audiencia_data} ${row.audiencia_hora ?? ''} ${row.motivo}`
      );
    }
    if (r.faltando.length > 15) console.log(`  … +${r.faltando.length - 15} mais`);
  }
}

async function sincronizarViaApi() {
  if (!senha) {
    console.error('\nPara --aplicar via API, defina VILAREAL_IMPORT_SENHA ou rode o backfill Java:');
    console.error('  cd e-vilareal-java-backend && ./mvnw test -Dtest=ProcessoAudienciaAgendaBackfillRunnerTest');
    process.exit(1);
  }
  const token = await loginObterToken({ baseUrl, login, senha });
  const r = await fetch(`${baseUrl}/api/agenda/eventos/sincronizar-audiencias-processos?todos=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Backfill API falhou: ${r.status} ${t.slice(0, 400)}`);
  }
  const body = await r.json();
  console.log('\n=== Backfill API concluído ===');
  console.log(JSON.stringify(body, null, 2));
}

async function main() {
  const conn = await conectarMysqlVilareal();
  try {
    const antes = await auditar(conn);
    imprimirRelatorio(antes);

    if (aplicar) {
      await sincronizarViaApi();
      const depois = await auditar(conn);
      console.log('\n=== Após sincronização ===');
      imprimirRelatorio(depois);
      if (depois.faltando.length > 0 || depois.incompletos.length > 0) {
        process.exitCode = 1;
      }
    } else {
      console.log('\nDry-run. Para corrigir: --aplicar (API) ou backfill Java (recomendado).');
    }
  } finally {
    await conn.end?.();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
