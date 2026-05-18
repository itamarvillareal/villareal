#!/usr/bin/env node
/**
 * Analisa `pessoa.nome` (e opcionalmente email) em busca de mojibake / pontuação herdada de planilhas.
 * Usa a mesma heurística base de `scripts/lib/normalizar-texto-planilha.mjs` + padrões UTF-8 corrompidos comuns.
 *
 * Uso:
 *   VILAREAL_MYSQL_PORT=3306 node scripts/analisar-mojibake-cadastro-pessoas.mjs
 *   VILAREAL_MYSQL_PORT=3306 node scripts/analisar-mojibake-cadastro-pessoas.mjs --limite=500 --json=relatorio.json
 *
 * Corrigir no banco: node scripts/corrigir-mojibake-cadastro-pessoas.mjs --aplicar
 * (ou npm run corrigir:mojibake-cadastro-pessoas)
 */

import fs from 'node:fs';
import process from 'node:process';

import { normalizarTextoPlanilha } from './lib/normalizar-texto-planilha.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';

const PADRAO_DIGRAFOS_MOJIBAKE =
  /Ã£|Ã©|Ã§|Ã¡|Ã­|Ã³|Ãº|Ãª|Ã‰|Ã“|Ã‡|Ãƒ|ÃŠ|Ãš|Ã€|Âº|Âª|â€“|â€”|â€™|â€œ|Ãƒ§/i;

/** Box drawing U+2500–U+257F ou U+251C (├) típico de dupla codificação. */
function temBoxDrawing(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.codePointAt(i);
    if (c === 0x251c || (c >= 0x2500 && c <= 0x257f)) return true;
  }
  return false;
}

/**
 * Sobrenome muito comum gravado sem til (planilha ASCII).
 * Não cobre todos os casos; só alerta padrões frequentes.
 */
function alertaTilProvavelmenteFaltando(nome) {
  const u = nome.toUpperCase();
  const alertas = [];
  /** «Magalhães» em maiúsculas correcto: MAGALHÃES (Ã + E + S). «MAGALHAES» costuma ser til em falta. */
  if (/\bMAGALHAES\b/.test(u)) alertas.push('MAGALHAES→Magalhães?');
  if (/\bCONCEICAO\b/.test(u)) alertas.push('CONCEICAO→Conceição?');
  if (/\bCORREA\b/.test(u) && !/CORRÊA/i.test(nome)) alertas.push('CORREA→Corrêa?');
  return alertas;
}

function parseArgs(argv) {
  let limite = 0;
  let jsonOut = '';
  for (const a of argv) {
    if (a.startsWith('--limite=')) limite = Math.max(0, Number(a.slice(9)) || 0);
    else if (a.startsWith('--json=')) jsonOut = a.slice(7);
  }
  return { limite, jsonOut };
}

async function main() {
  const { limite, jsonOut } = parseArgs(process.argv.slice(2));
  const conn = await conectarMysqlVilareal();
  try {
    const [rows] = await conn.query(
      'SELECT id, nome, email FROM pessoa WHERE nome IS NOT NULL AND nome != "" ORDER BY id'
    );

    const porPlanilha = [];
    const porDigrafo = [];
    const porBox = [];
    const porTil = [];
    const vistos = new Set();

    for (const r of rows) {
      const nome = String(r.nome ?? '');
      const email = String(r.email ?? '');
      const normNome = normalizarTextoPlanilha(nome);
      const normEmail = normalizarTextoPlanilha(email);

      if (normNome !== nome.trim()) {
        porPlanilha.push({ id: r.id, campo: 'nome', antes: nome, depois: normNome });
      } else if (PADRAO_DIGRAFOS_MOJIBAKE.test(nome)) {
        porDigrafo.push({ id: r.id, nome });
      }

      if (temBoxDrawing(nome)) {
        porBox.push({ id: r.id, nome });
      }

      const til = alertaTilProvavelmenteFaltando(nome);
      if (til.length) {
        porTil.push({ id: r.id, nome, alertas: til });
      }

      if (normEmail && normEmail !== email.trim()) {
        porPlanilha.push({ id: r.id, campo: 'email', antes: email, depois: normEmail });
      }
    }

    const uniqPlanilhaPorUsuario = [];
    for (const item of porPlanilha) {
      const k = `${item.id}:${item.campo}`;
      if (!vistos.has(k)) {
        vistos.add(k);
        uniqPlanilhaPorUsuario.push(item);
      }
    }

    const resumo = {
      totalPessoas: rows.length,
      comSubstituicaoPlanilha: uniqPlanilhaPorUsuario.length,
      comDigrafoMojibakeRestante: porDigrafo.length,
      comBoxDrawing: porBox.length,
      comAlertaTil: porTil.length,
      amostraPlanilha: uniqPlanilhaPorUsuario.slice(0, 30),
      amostraBox: porBox.slice(0, 20),
      amostraTil: porTil.slice(0, 30),
    };

    console.log(`Cadastro de pessoas — análise de mojibake / acentuação
Total de linhas: ${resumo.totalPessoas}
· Nome/email mudariam com normalizar-texto-planilha (padrão import): ${resumo.comSubstituicaoPlanilha}
· Nomes ainda com dígrafos típicos Ã£, Ã©, … (após heurística acima, ou mistura): ${resumo.comDigrafoMojibakeRestante}
· Nomes com caracteres «box drawing» (├…): ${resumo.comBoxDrawing}
· Alertas heurísticos (til possivelmente em falta): ${resumo.comAlertaTil}

Nota: A API Java já aplica Utf8MojibakeUtil.corrigir() na leitura (listagem cadastro).
Dados crus no MySQL podem continuar errados; relatórios SQL diretos mostram lixo até corrigir a tabela.

Amostra — substituição planilha (até 10):`);
    for (const x of resumo.amostraPlanilha.slice(0, 10)) {
      console.log(`  id=${x.id} [${x.campo}] ${JSON.stringify(x.antes).slice(0, 80)}… → ${JSON.stringify(x.depois).slice(0, 80)}…`);
    }
    if (resumo.amostraBox.length) {
      console.log('\nAmostra — box drawing:');
      for (const x of resumo.amostraBox.slice(0, 5)) {
        console.log(`  id=${x.id} ${JSON.stringify(x.nome).slice(0, 120)}`);
      }
    }
    if (resumo.amostraTil.length) {
      console.log('\nAmostra — til/surname (até 10):');
      for (const x of resumo.amostraTil.slice(0, 10)) {
        console.log(`  id=${x.id} ${x.alertas.join(', ')} | ${JSON.stringify(x.nome).slice(0, 100)}`);
      }
    }

    let saida = resumo;
    if (jsonOut) {
      const payload = limite > 0
        ? {
            ...resumo,
            todasSubstituicoes: uniqPlanilhaPorUsuario.slice(0, limite),
            todosBox: porBox.slice(0, limite),
            todosTil: porTil.slice(0, limite),
          }
        : {
            ...resumo,
            todasSubstituicoes: uniqPlanilhaPorUsuario,
            todosBox: porBox,
            todosTil: porTil,
          };
      fs.writeFileSync(jsonOut, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`\nJSON completo: ${jsonOut}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
