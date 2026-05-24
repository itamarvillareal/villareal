#!/usr/bin/env node
/**
 * Monta a árvore de tópicos a partir dos .txt em Dropbox «Banco de Dados/Tópicos».
 *
 * Convenção legada: nome do arquivo = caminho com «=»; último segmento = item selecionável.
 * Ex.: `CONTRATOS=LOCAÇÃO=GERAL - Multa fixa.txt`
 *
 * Uso:
 *   node scripts/import-topicos-hierarchy.mjs
 *   node scripts/import-topicos-hierarchy.mjs --escrever
 *   node scripts/import-topicos-hierarchy.mjs --relatorio=topicos-resumo.json
 *   node scripts/import-topicos-hierarchy.mjs --aplicar   # PUT na API (requer login)
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';

const RAIZ_ID = '_raiz';
const SELECAO_UNICA_CAMINHOS = new Set([
  'CONTRATOS|LOCAÇÃO',
  'CONTRATOS|INTERMEDIAÇÃO IMOBILIÁRIA',
]);

function parseArgs(argv) {
  const out = {
    base: path.join(resolverBaseBancoDados(), 'Tópicos'),
    escrever: false,
    relatorio: null,
    aplicar: false,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
  };
  for (const a of argv) {
    if (a === '--escrever') out.escrever = true;
    else if (a === '--aplicar') out.aplicar = true;
    else if (a.startsWith('--base=')) out.base = a.slice(7);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
  }
  return out;
}

function normalizarLabel(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifySegment(label) {
  return normalizarLabel(label)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function criarNo(id, label) {
  return { id, label: normalizarLabel(label), children: [], items: [] };
}

function ordenarNo(no) {
  if (no.children?.length) {
    no.children.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    for (const ch of no.children) ordenarNo(ch);
  }
  if (no.items?.length) {
    no.items.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }
}

function finalizarNo(no) {
  if (no.items.length > 0) {
    delete no.children;
  } else if (no.children.length > 0) {
    delete no.items;
    for (const ch of no.children) finalizarNo(ch);
  } else {
    delete no.children;
    delete no.items;
  }
}

function caminhoChave(segments) {
  return segments.map(normalizarLabel).join('|');
}

function montarHierarquia(dirTopicos) {
  const raiz = criarNo(RAIZ_ID, 'Início');
  const nosPorCaminho = new Map([[ '', raiz ]]);
  const idsUsados = new Set([RAIZ_ID]);
  const arquivos = fs.readdirSync(dirTopicos).filter((n) => n.toLowerCase().endsWith('.txt')).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  let ignorados = 0;

  for (const nome of arquivos) {
    const stem = nome.slice(0, -4);
    const partes = stem.split('=').map(normalizarLabel).filter(Boolean);
    if (partes.length < 2) {
      ignorados += 1;
      continue;
    }

    const categorias = partes.slice(0, -1);
    const folhaLabel = partes[partes.length - 1];
    let caminho = '';
    let pai = raiz;

    for (const cat of categorias) {
      caminho = caminho ? `${caminho}|${cat}` : cat;
      let filho = nosPorCaminho.get(caminho);
      if (!filho) {
        const baseId = slugifySegment(caminho.replace(/\|/g, '-'));
        let id = baseId || 'no';
        let n = 2;
        while (idsUsados.has(id)) {
          id = `${baseId}-${n}`;
          n += 1;
        }
        idsUsados.add(id);
        filho = criarNo(id, cat);
        pai.children.push(filho);
        nosPorCaminho.set(caminho, filho);

        if (SELECAO_UNICA_CAMINHOS.has(caminho)) {
          filho.selecaoUnica = true;
        }
      }
      pai = filho;
    }

    const itemBaseId = slugifySegment(`${caminho}|${folhaLabel}`);
    let itemId = itemBaseId || 'item';
    let nItem = 2;
    while (idsUsados.has(itemId)) {
      itemId = `${itemBaseId}-${nItem}`;
      nItem += 1;
    }
    idsUsados.add(itemId);
    pai.items.push({ id: itemId, label: folhaLabel });
  }

  for (const no of nosPorCaminho.values()) ordenarNo(no);

  const stats = {
    arquivos: arquivos.length,
    ignorados,
    categorias: nosPorCaminho.size - 1,
    folhas: [...nosPorCaminho.values()].reduce((acc, no) => acc + (no.items?.length ?? 0), 0),
    topLevel: raiz.children.length,
  };

  for (const ch of raiz.children) finalizarNo(ch);

  return {
    raiz: {
      id: raiz.id,
      label: raiz.label,
      children: raiz.children.map((ch) => {
        const out = { ...ch };
        return out;
      }),
    },
    stats,
  };
}

function serializarJs(obj, indent = 0) {
  const sp = '  '.repeat(indent);
  if (obj == null) return 'null';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const lines = obj.map((v) => `${sp}  ${serializarJs(v, indent + 1)}`);
    return `[\n${lines.join(',\n')}\n${sp}]`;
  }
  const entries = Object.entries(obj);
  const lines = entries.map(([k, v]) => {
    const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
    return `${sp}  ${key}: ${serializarJs(v, indent + 1)}`;
  });
  return `{\n${lines.join(',\n')}\n${sp}}`;
}

function gerarArquivoTopicosHierarchy(raiz) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `/**
 * Árvore de tópicos: ramos (\`children\`) ou folha com lista selecionável (\`items\`).
 * Gerado automaticamente por \`scripts/import-topicos-hierarchy.mjs\` em ${stamp}.
 * Fonte: Dropbox «Banco de Dados/Tópicos» (*.txt, caminho no nome com «=»).
 */

export const TOPICOS_RAIZ = ${serializarJs(raiz, 0)};

/**
 * @param {TopicoNo} root
 * @param {string[]} stackIds ids do caminho a partir dos filhos da raiz (não inclui _raiz)
 * @returns {TopicoNo | null}
 */
export function resolverNoPorCaminho(root, stackIds) {
  let node = root;
  for (const id of stackIds) {
    const next = node.children?.find((c) => c.id === id);
    if (!next) return null;
    node = next;
  }
  return node;
}

/** Rótulos do caminho para breadcrumb (um rótulo por id em \`pathStack\`). */
export function rotulosDoCaminho(raiz, pathStack) {
  const out = [];
  let node = raiz;
  for (const id of pathStack) {
    const next = node.children?.find((c) => c.id === id);
    if (!next) break;
    out.push(next.label);
    node = next;
  }
  return out;
}
`;
}

async function loginApi(baseUrl, login, senha) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, senha }),
  });
  if (!res.ok) {
    throw new Error(`Login falhou (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  if (!body?.token) throw new Error('Login sem token.');
  return body.token;
}

async function aplicarNaApi(baseUrl, token, raiz) {
  const res = await fetch(`${baseUrl}/api/topicos/hierarchy`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(raiz),
  });
  if (!res.ok) {
    throw new Error(`PUT hierarchy falhou (${res.status}): ${await res.text()}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.base)) {
    console.error(`Pasta não encontrada: ${args.base}`);
    process.exit(1);
  }

  const { raiz, stats } = montarHierarquia(args.base);
  console.log('Tópicos importados da pasta:', args.base);
  console.log(`  arquivos .txt: ${stats.arquivos}`);
  console.log(`  ignorados:     ${stats.ignorados}`);
  console.log(`  categorias:    ${stats.categorias}`);
  console.log(`  itens folha:   ${stats.folhas}`);
  console.log(`  raízes:        ${stats.topLevel}`);

  if (args.relatorio) {
    fs.writeFileSync(args.relatorio, JSON.stringify({ stats, raiz }, null, 2), 'utf8');
    console.log('Relatório:', path.resolve(args.relatorio));
  }

  if (args.escrever) {
    const outPath = path.resolve('src/data/topicosHierarchy.js');
    fs.writeFileSync(outPath, gerarArquivoTopicosHierarchy(raiz), 'utf8');
    console.log('Escrito:', outPath);
  }

  if (args.aplicar) {
    const token = await loginApi(args.baseUrl, args.login, args.senha);
    await aplicarNaApi(args.baseUrl, token, raiz);
    console.log('Hierarquia aplicada na API:', args.baseUrl);
  }

  if (!args.escrever && !args.relatorio && !args.aplicar) {
    console.log('\nUse --escrever para atualizar src/data/topicosHierarchy.js');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
