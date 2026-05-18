#!/usr/bin/env node
/**
 * Importação de **um** processo a partir dos txt locais (Dropbox «Banco de Dados»).
 *
 * Ordem (com --aplicar):
 *   1. Cabeçalho (Proc/Gerais numéricos + semânticos + fase/obs + prazo)
 *   2. Histórico HC → `import-historico-local-txt.mjs` (normalização e API existentes)
 *   3. Vínculo imóvel `0.89.1` (opcional)
 *   4. Partes `1.1` / `6.1` (opcional, --importar-partes)
 *
 * Uso:
 *   node scripts/import-processo-txt.mjs --cliente=728 --processo=239 --dry-run
 *   VILAREAL_IMPORT_SENHA='…' node scripts/import-processo-txt.mjs --cliente=728 --processo=239 --aplicar --login=itamar
 *
 * Opções:
 *   --cliente=N --processo=N     Obrigatórios
 *   --dry-run | --aplicar
 *   --sem-historico              Não importa andamentos
 *   --sem-imovel                 Não vincula imóvel 0.89.1
 *   --importar-partes            Cria partes a partir de 1.1 e 6.1 (se ainda não existirem)
 *   --substituir-historico       Repassa --substituir-andamentos ao import de histórico
 *   --sem-corrigir-historico     Repassa --sem-corrigir ao import de histórico
 *   --aplicar-correcao-historico Repassa --aplicar-correcao
 *   --base=PATH                  Raiz «Banco de Dados»
 *   --relatorio=JSON
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { DEFAULT_BASE_HISTORICO_LOCAL } from './lib/historico-local-txt-paths.mjs';
import {
  buscarProcesso,
  loginImportApi,
  resolverPessoaIdCliente,
} from './lib/vilareal-import-processo-api.mjs';
import { atualizarProcessoApi } from './lib/import-processo-put-body.mjs';
import {
  levantarDadosProcessoTxt,
  montarPatchProcessoFromTxt,
} from './lib/proc-processo-dados-txt.mjs';
import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_HISTORICO = path.join(__dirname, 'import-historico-local-txt.mjs');

function parseArgs(argv) {
  const out = {
    cliente: null,
    processo: null,
    dryRun: true,
    aplicar: false,
    semHistorico: false,
    semImovel: false,
    importarPartes: false,
    substituirHistorico: false,
    semCorrigirHistorico: false,
    aplicarCorrecaoHistorico: false,
    base: resolverBaseBancoDados(),
    baseHistorico: DEFAULT_BASE_HISTORICO_LOCAL,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8081').replace(/\/$/, ''),
    relatorio: null,
  };

  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--sem-historico') out.semHistorico = true;
    else if (a === '--sem-imovel') out.semImovel = true;
    else if (a === '--importar-partes') out.importarPartes = true;
    else if (a === '--substituir-historico') out.substituirHistorico = true;
    else if (a === '--sem-corrigir-historico') out.semCorrigirHistorico = true;
    else if (a === '--aplicar-correcao-historico') out.aplicarCorrecaoHistorico = true;
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.cliente = Math.trunc(n);
    } else if (a.startsWith('--processo=')) {
      const n = Number(a.slice(11));
      if (Number.isFinite(n) && n >= 1) out.processo = Math.trunc(n);
    } else if (a.startsWith('--base=')) {
      out.base = path.resolve(a.slice(7));
      out.baseHistorico = out.base;
    } else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
  }

  return out;
}

function imprimirPreview(dados, patch) {
  console.log(`\n=== Processo ${dados.cod8} / ${dados.numeroInterno} ===\n`);
  console.log('Resumo:', JSON.stringify(dados.resumo, null, 2));
  console.log('\nPatch API (processo):');
  console.log(JSON.stringify(patch, null, 2));
  if (Object.keys(dados.cabecalho.fontes).length) {
    console.log('\nFontes cabeçalho:');
    for (const [k, v] of Object.entries(dados.cabecalho.fontes)) {
      console.log(`  ${k}: ${path.basename(v)}`);
    }
  }
  if (dados.semantic?.fontes) {
    console.log('\nFontes semânticos:');
    for (const [k, v] of Object.entries(dados.semantic.fontes)) {
      console.log(`  ${k}: ${path.basename(v)}`);
    }
  }
  if (dados.fase) {
    console.log('\nFase txt:', {
      fase: dados.fase.faseCanonica,
      obs: dados.fase.observacaoFase?.slice?.(0, 60),
      inativo: dados.fase.statusInativo,
    });
  }
  if (dados.imovel?.numeroPlanilha) {
    console.log('\nImóvel 0.89.1:', dados.imovel.numeroPlanilha, dados.imovel.arquivo);
  }
  const { parteClienteNome, parteContraparteNome } = dados.cabecalho.partesTxt;
  if (parteClienteNome || parteContraparteNome) {
    console.log('\nPartes txt:', { parteClienteNome, parteContraparteNome });
  }
  console.log(`\nHistórico: ${dados.entradasHistorico.length} entrada(s) válida(s) para importar\n`);
}

function executarImportHistorico(opts) {
  const args = [
    SCRIPT_HISTORICO,
    `--cliente=${opts.cliente}`,
    `--processo=${opts.processo}`,
    `--base=${opts.baseHistorico}`,
    `--login=${opts.login}`,
  ];
  if (opts.semCorrigirHistorico) args.push('--sem-corrigir');
  if (opts.aplicarCorrecaoHistorico) args.push('--aplicar-correcao');
  if (opts.substituirHistorico) {
    args.push('--substituir-andamentos');
  } else {
    /** Backend Docker antigo pode não expor DELETE manutenção — evita falha na importação. */
    args.push('--nao-limpar-import');
  }
  if (opts.senha) args.push(`--senha=${opts.senha}`);

  console.log('\n[histórico] A invocar import-historico-local-txt.mjs…');
  const r = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '..'),
  });
  return r.status === 0;
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} processoId
 */
async function listarPartes(baseUrl, token, processoId) {
  const res = await fetch(`${baseUrl}/api/processos/${processoId}/partes`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} processoId
 * @param {object} body
 */
async function criarParte(baseUrl, token, processoId, body) {
  const res = await fetch(`${baseUrl}/api/processos/${processoId}/partes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`POST parte: ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * @param {object} opts
 * @param {string} token
 * @param {object} proc
 * @param {ReturnType<typeof levantarDadosProcessoTxt>} dados
 */
async function importarPartesTxt(opts, token, proc, dados) {
  const { parteClienteNome, parteContraparteNome } = dados.cabecalho.partesTxt;
  if (!parteClienteNome && !parteContraparteNome) {
    console.log('[partes] Sem ficheiros 1.1 / 6.1 — ignorado.');
    return { criadas: 0, puladas: 0 };
  }

  const existentes = await listarPartes(opts.baseUrl, token, proc.id);
  const nomesExistentes = new Set(
    existentes.map((p) =>
      String(p.nomeLivre ?? p.nome ?? '')
        .trim()
        .toUpperCase()
    )
  );

  const papel = dados.semantic?.campos?.papelCliente ?? proc.papelCliente ?? 'REQUERENTE';
  const poloCliente = papel === 'REQUERIDO' ? 'REU' : 'AUTOR';
  const poloContraparte = poloCliente === 'AUTOR' ? 'REU' : 'AUTOR';

  /** @type {{ nome: string, polo: string, ordem: number }[]} */
  const plano = [];
  if (parteClienteNome) plano.push({ nome: parteClienteNome, polo: poloCliente, ordem: 0 });
  if (parteContraparteNome) plano.push({ nome: parteContraparteNome, polo: poloContraparte, ordem: 0 });

  let criadas = 0;
  let puladas = 0;

  for (const item of plano) {
    const key = item.nome.trim().toUpperCase();
    if (!key || nomesExistentes.has(key)) {
      puladas += 1;
      continue;
    }
    if (opts.dryRun) {
      console.log(`[partes] dry-run criaria: ${item.polo} — ${item.nome.slice(0, 60)}`);
      criadas += 1;
      continue;
    }
    await criarParte(opts.baseUrl, token, proc.id, {
      nomeLivre: item.nome.trim(),
      polo: item.polo,
      ordem: item.ordem,
      importacaoId: 'import-processo-txt',
    });
    nomesExistentes.add(key);
    criadas += 1;
  }

  return { criadas, puladas };
}

/**
 * Vínculo imóvel simplificado (um processo).
 * @param {object} opts
 * @param {string} token
 * @param {object} proc
 * @param {ReturnType<typeof levantarDadosProcessoTxt>} dados
 */
async function importarImovelTxt(opts, token, proc, dados) {
  const reg = dados.imovel;
  if (!reg?.numeroPlanilha) {
    console.log('[imóvel] Sem ficheiro 0.89.1 — ignorado.');
    return { acao: 'ausente' };
  }

  if (opts.dryRun) {
    console.log(`[imóvel] dry-run vincularia planilha ${reg.numeroPlanilha}`);
    return { acao: 'dry_run' };
  }

  const pessoaPorCod8 = new Map();
  const pessoaId = await resolverPessoaIdCliente(
    opts.baseUrl,
    token,
    dados.cod8,
    pessoaPorCod8
  );
  if (!pessoaId) throw new Error('Cliente não encontrado na API');

  const resImoveis = await fetch(`${opts.baseUrl}/api/imoveis`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!resImoveis.ok) throw new Error(`GET imoveis: ${resImoveis.status}`);
  const todos = await resImoveis.json();
  let imovel = todos.find(
    (i) =>
      Number(i.clienteId) === Number(pessoaId) &&
      Number(i.numeroPlanilha) === Number(reg.numeroPlanilha)
  );

  if (imovel?.processoId != null && Number(imovel.processoId) === Number(proc.id)) {
    return { acao: 'ja_vinculado', imovelId: imovel.id };
  }

  if (imovel?.id) {
    const putBody = {
      clienteId: pessoaId,
      processoId: proc.id,
      numeroPlanilha: imovel.numeroPlanilha ?? reg.numeroPlanilha,
      situacao: imovel.situacao ?? 'DESOCUPADO',
      ativo: imovel.ativo ?? true,
      observacoes: imovel.observacoes ?? null,
    };
    const resPut = await fetch(`${opts.baseUrl}/api/imoveis/${imovel.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(putBody),
    });
    if (!resPut.ok) {
      const t = await resPut.text();
      throw new Error(`PUT imovel: ${resPut.status} ${t.slice(0, 200)}`);
    }
    return { acao: 'atualizado', imovelId: imovel.id };
  }

  const resPost = await fetch(`${opts.baseUrl}/api/imoveis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      clienteId: pessoaId,
      processoId: proc.id,
      numeroPlanilha: reg.numeroPlanilha,
      situacao: 'DESOCUPADO',
      ativo: true,
      observacoes: `Vínculo Proc/0.89.1 (import-processo-txt).`,
    }),
  });
  if (!resPost.ok) {
    const t = await resPost.text();
    throw new Error(`POST imovel: ${resPost.status} ${t.slice(0, 200)}`);
  }
  const criado = await resPost.json();
  return { acao: 'criado', imovelId: criado.id };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.cliente == null || opts.processo == null) {
    console.error('Uso: node scripts/import-processo-txt.mjs --cliente=N --processo=N [--dry-run|--aplicar]');
    process.exit(1);
  }

  if (opts.aplicar && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha= para --aplicar');
    process.exit(1);
  }

  const dados = levantarDadosProcessoTxt(opts.cliente, opts.processo, {
    baseBanco: opts.base,
    baseHistorico: opts.baseHistorico,
  });
  const patch = montarPatchProcessoFromTxt(dados);

  imprimirPreview(dados, patch);

  const resultado = {
    opts: {
      cliente: opts.cliente,
      processo: opts.processo,
      dryRun: opts.dryRun,
    },
    patch,
    resumo: dados.resumo,
    etapas: {},
  };

  if (opts.dryRun) {
    console.log('Modo dry-run — nenhuma gravação na API.');
    if (opts.relatorio) {
      fs.writeFileSync(opts.relatorio, JSON.stringify(resultado, null, 2), 'utf8');
    }
    return;
  }

  const token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
  const pessoaPorCod8 = new Map();
  const proc = await buscarProcesso(opts.baseUrl, token, dados.cod8, dados.numeroInterno, pessoaPorCod8);

  if (!proc?.id) {
    console.error(
      `\nProcesso ${dados.cod8}/${dados.numeroInterno} não existe na API. Crie o registo (planilha ou cadastro) antes de importar.\n`
    );
    process.exit(2);
  }

  if (Object.keys(patch).length > 0) {
    await atualizarProcessoApi(opts.baseUrl, token, proc, patch);
    resultado.etapas.cabecalho = 'atualizado';
    console.log('\n[cabeçalho] Processo atualizado na API.');
  } else {
    resultado.etapas.cabecalho = 'vazio';
    console.log('\n[cabeçalho] Nenhum campo txt para gravar.');
  }

  if (!opts.semHistorico) {
    const ok = executarImportHistorico(opts);
    resultado.etapas.historico = ok ? 'ok' : 'falhou';
    if (!ok) process.exit(3);
  } else {
    resultado.etapas.historico = 'ignorado';
  }

  if (!opts.semImovel) {
    try {
      resultado.etapas.imovel = await importarImovelTxt(opts, token, proc, dados);
      console.log('[imóvel]', resultado.etapas.imovel);
    } catch (e) {
      resultado.etapas.imovel = { erro: e?.message || String(e) };
      console.warn('[imóvel] erro:', e?.message || e);
    }
  }

  if (opts.importarPartes) {
    try {
      resultado.etapas.partes = await importarPartesTxt(opts, token, proc, dados);
      console.log('[partes]', resultado.etapas.partes);
    } catch (e) {
      resultado.etapas.partes = { erro: e?.message || String(e) };
      console.warn('[partes] erro:', e?.message || e);
    }
  }

  console.log('\n=== Importação concluída ===\n');
  if (opts.relatorio) {
    fs.writeFileSync(opts.relatorio, JSON.stringify(resultado, null, 2), 'utf8');
    console.log(`Relatório: ${opts.relatorio}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
