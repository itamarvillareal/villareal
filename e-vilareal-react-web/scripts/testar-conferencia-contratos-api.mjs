#!/usr/bin/env node
/**
 * Smoke test das ações do modal de conferência (API local).
 * Uso: node scripts/testar-conferencia-contratos-api.mjs --base-url=http://localhost:8080
 */
import './lib/load-vilareal-import-env.mjs';
import { loginImportApi } from './lib/vilareal-import-processo-api.mjs';

const base = process.argv.includes('--base-url=')
  ? process.argv.find((a) => a.startsWith('--base-url=')).slice('--base-url='.length)
  : process.env.VILAREAL_API_BASE || 'http://localhost:8080';
const senhaIdx = process.argv.indexOf('--senha');
const senha = senhaIdx >= 0 ? process.argv[senhaIdx + 1] : process.env.VILAREAL_IMPORT_SENHA || '';

const resultados = [];

function ok(nome, detalhe = '') {
  resultados.push({ nome, ok: true, detalhe });
  console.log(`✓ ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
}
function fail(nome, detalhe = '') {
  resultados.push({ nome, ok: false, detalhe });
  console.error(`✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
}

async function main() {
  if (!senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA em .env.import.local ou use --senha');
    process.exit(1);
  }
  let token;
  const logins = [process.env.VILAREAL_IMPORT_LOGIN || 'itamar', 'karla.pedroza'].filter(
    (v, i, a) => v && a.indexOf(v) === i,
  );
  let lastErr;
  for (const login of logins) {
    try {
      token = await loginImportApi(base, login, senha);
      ok('Login API', login);
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!token) throw lastErr || new Error('Login falhou');
  const h = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  const filaRes = await fetch(`${base}/api/documentos/contratos-honorarios/importar/fila?status=EM_REVISAO&page=0&size=5`, { headers: h });
  if (!filaRes.ok) {
    fail('Carregar fila EM_REVISAO', String(filaRes.status));
    process.exit(1);
  }
  const fila = await filaRes.json();
  ok('Carregar fila', `${fila.totalElements} itens EM_REVISAO`);

  let item = fila.content?.[0];
  if (!item?.importacaoId) {
    const allRes = await fetch(`${base}/api/documentos/contratos-honorarios/importar/fila?page=0&size=5`, { headers: h });
    if (allRes.ok) {
      const all = await allRes.json();
      item = all.content?.[0];
      ok('Carregar fila (qualquer status)', `${all.totalElements} itens`);
    }
  }

  if (!item?.importacaoId) {
    ok('Endpoints sem item', 'fila vazia — testando rotas genéricas');
    const censoRes = await fetch(`${base}/api/documentos/contratos-honorarios/importar/relatorio/censo`, { headers: h });
    if (!censoRes.ok) fail('Relatório censo', String(censoRes.status));
    else ok('Relatório censo');
    const missRes = await fetch(`${base}/api/documentos/contratos-honorarios/importar/999999999`, { headers: h });
    if ([404, 422].includes(missRes.status)) ok('Obter detalhe inexistente', String(missRes.status));
    else fail('Obter detalhe inexistente', String(missRes.status));
    const pdfMiss = await fetch(`${base}/api/documentos/contratos-honorarios/importar/999999999/pdf`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
    });
    if ([401, 403, 404, 422].includes(pdfMiss.status)) ok('Preview PDF inexistente', String(pdfMiss.status));
    else fail('Preview PDF inexistente', String(pdfMiss.status));
    const revMiss = await fetch(`${base}/api/documentos/contratos-honorarios/importar/999999999/revisao`, {
      method: 'PATCH',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dadosAprovados: {}, roteamentoTipo: 'HONORARIOS' }),
    });
    if ([400, 404, 422].includes(revMiss.status)) ok('Salvar rascunho inválido', String(revMiss.status));
    else fail('Salvar rascunho inválido', String(revMiss.status));
    const rejMiss = await fetch(`${base}/api/documentos/contratos-honorarios/importar/999999999/rejeitar`, {
      method: 'POST',
      headers: h,
    });
    if ([400, 404, 422].includes(rejMiss.status)) ok('Rejeitar inexistente', String(rejMiss.status));
    else fail('Rejeitar inexistente', String(rejMiss.status));
    const aprMiss = await fetch(`${base}/api/documentos/contratos-honorarios/importar/999999999/aprovar`, {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roteamentoTipo: 'HONORARIOS', dadosAprovados: {} }),
    });
    if ([400, 404, 422].includes(aprMiss.status)) ok('Aprovar inexistente', String(aprMiss.status));
    else fail('Aprovar inexistente', String(aprMiss.status));
    const concMiss = await fetch(`${base}/api/documentos/contratos-honorarios/importar/999999999/conciliar-retroativo`, {
      method: 'POST',
      headers: h,
    });
    if ([400, 404, 422].includes(concMiss.status)) ok('Conciliar retroativo inexistente', String(concMiss.status));
    else fail('Conciliar retroativo inexistente', String(concMiss.status));
    const falhas = resultados.filter((r) => !r.ok).length;
    console.log(`\n${resultados.length - falhas}/${resultados.length} testes OK (fila vazia)`);
    process.exit(falhas ? 1 : 0);
  }
  const id = item.importacaoId;
  ok('Selecionar item', `#${id}`);

  const detRes = await fetch(`${base}/api/documentos/contratos-honorarios/importar/${id}`, { headers: h });
  if (!detRes.ok) fail('Obter detalhe', String(detRes.status));
  else {
    const det = await detRes.json();
    ok('Obter detalhe', det.pdfNomeArquivo);
  }

  const pdfRes = await fetch(`${base}/api/documentos/contratos-honorarios/importar/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
  });
  if (!pdfRes.ok) fail('Preview PDF', String(pdfRes.status));
  else {
    const buf = await pdfRes.arrayBuffer();
    ok('Preview PDF', `${buf.byteLength} bytes`);
  }

  const dados = item.dadosAprovados || item.dadosExtraidos;
  const revRes = await fetch(`${base}/api/documentos/contratos-honorarios/importar/${id}/revisao`, {
    method: 'PATCH',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dadosAprovados: dados,
      roteamentoTipo: item.roteamentoTipo || 'HONORARIOS',
      processoId: item.processoId ?? item.processoSugerido?.processoId ?? null,
    }),
  });
  if (!revRes.ok) fail('Salvar rascunho (PATCH revisao)', await revRes.text().then((t) => t.slice(0, 120)));
  else ok('Salvar rascunho');

  const pid = item.processoId ?? item.processoSugerido?.processoId;
  if (pid) {
    const finRes = await fetch(`${base}/api/financeiro/lancamentos/resumo-processo/${pid}`, { headers: h });
    if (!finRes.ok) fail('Resumo conta corrente', String(finRes.status));
    else {
      const fin = await finRes.json();
      ok('Resumo conta corrente', `saldo=${fin.saldo}, lanc=${fin.totalLancamentos}`);
    }
    const lancRes = await fetch(`${base}/api/financeiro/lancamentos?processoId=${pid}`, { headers: h });
    if (!lancRes.ok) fail('Lançamentos processo', String(lancRes.status));
    else {
      const lancs = await lancRes.json();
      ok('Lançamentos processo', `${Array.isArray(lancs) ? lancs.length : 0} registros`);
    }
  } else {
    ok('Financeiro', 'sem processo — pulado');
  }

  const censoRes = await fetch(`${base}/api/documentos/contratos-honorarios/importar/relatorio/censo`, { headers: h });
  if (!censoRes.ok) fail('Relatório censo', String(censoRes.status));
  else ok('Relatório censo');

  const falhas = resultados.filter((r) => !r.ok).length;
  console.log(`\n${resultados.length - falhas}/${resultados.length} testes OK`);
  if (falhas) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
