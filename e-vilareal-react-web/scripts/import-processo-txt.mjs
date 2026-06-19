#!/usr/bin/env node
/**
 * Importação de **um** processo a partir dos txt locais (Dropbox «Banco de Dados»).
 *
 * Ordem (com --aplicar):
 *   1. Cliente — pessoa (Gerais `151.1.0` → POST /api/clientes)
 *   2. Cabeçalho (Proc/Gerais numéricos + semânticos + fase/obs + prazo fatal 145.1 em Gerais/{Milhar}/{Centena}/{Unidade}/ + tramitação 147.1)
 *   3. Histórico HC → `import-historico-local-txt.mjs` (normalização e API existentes)
 *   4. Vínculo imóvel `0.89.1` (opcional)
 *   5. Partes `1.1` / `6.1` (opcional, --importar-partes)
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
 *   --sem-cliente-pessoa         Não sincroniza pessoa do cliente (151.1.0)
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
  garantirProcessoNaApi,
  loginImportApi,
  resolverClienteFromApi,
} from './lib/vilareal-import-processo-api.mjs';
import {
  buscarImovelPorClientePlanilha,
  garantirImovelClientePlanilha,
  jaVinculadoProcesso,
  vincularProcessoImovel,
} from './lib/imovel-processo-vinculo-api.mjs';
import { atualizarProcessoApi } from './lib/import-processo-put-body.mjs';
import { upsertPrazoFatalEntidade } from './lib/prazo-fatal-api.mjs';
import {
  construirMapaUsuarioPorNomeResponsavel,
  fetchUsuariosImportApi,
  resolverUsuarioResponsavelId,
} from './lib/responsavel-usuario-import.mjs';
import {
  levantarDadosProcessoTxt,
  montarPatchProcessoFromTxt,
} from './lib/proc-processo-dados-txt.mjs';
import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import {
  sincronizarVinculoClientePessoaApi,
} from './lib/cliente-pessoa-151-txt.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { resolverBaseUrlImport } from './lib/vilareal-import-api-base.mjs';

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
    semClientePessoa: false,
    substituirClientePessoa: false,
    importarPartes: false,
    substituirHistorico: false,
    semCorrigirHistorico: false,
    aplicarCorrecaoHistorico: false,
    base: resolverBaseBancoDados(),
    baseHistorico: DEFAULT_BASE_HISTORICO_LOCAL,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: resolverBaseUrlImport(),
    relatorio: null,
  };

  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--sem-historico') out.semHistorico = true;
    else if (a === '--sem-imovel') out.semImovel = true;
    else if (a === '--sem-cliente-pessoa') out.semClientePessoa = true;
    else if (a === '--substituir-cliente-pessoa') out.substituirClientePessoa = true;
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
  if (dados.statusProcesso) {
    const st = dados.statusProcesso;
    console.log('\nStatus.Processo txt:', {
      arquivo: st.arquivoStatus ? path.basename(st.arquivoStatus) : '(ausente)',
      statusBruto: st.statusBruto ?? '(vazio)',
      ativo: st.ativo,
      inativo: st.statusInativo,
    });
  }
  if (dados.fase) {
    console.log('\nFase txt:', {
      fase: dados.fase.faseCanonica,
      obs: dados.fase.observacaoFase?.slice?.(0, 60),
      inativo: dados.fase.statusInativo,
      statusBruto: dados.fase.statusBruto,
    });
  }
  if (dados.cabecalho.partesTxt?.responsavelNome) {
    console.log('\nResponsável txt (20.1):', dados.cabecalho.partesTxt.responsavelNome);
  }
  if (dados.cabecalho.campos.unidade) {
    console.log('Unidade txt (0.88.1):', dados.cabecalho.campos.unidade);
  }
  if (dados.cabecalho.campos.tramitacao) {
    console.log('Tramitação txt (147.1):', dados.cabecalho.campos.tramitacao);
  }
  if (dados.cabecalho.campos.prazoFatal) {
    console.log('Prazo fatal txt (145.1):', dados.cabecalho.campos.prazoFatal);
    if (dados.cabecalho.fontes.prazoFatal) {
      console.log('  fonte:', dados.cabecalho.fontes.prazoFatal);
    }
  }
  if (dados.semantic?.campos?.audienciaData || dados.semantic?.campos?.audienciaHora) {
    console.log('Audiência txt:', {
      data: dados.semantic.campos.audienciaData,
      hora: dados.semantic.campos.audienciaHora,
      tipo: dados.semantic.campos.audienciaTipo,
    });
  }
  if (dados.pessoaCliente?.pessoaId) {
    console.log('\nPessoa cliente txt (151.1.0):', dados.pessoaCliente.pessoaId);
  } else if (dados.pessoaCliente?.arquivo) {
    console.log('\nPessoa cliente txt (151.1.0): arquivo presente mas sem ID válido');
  }
  if (dados.imovel?.numeroPlanilha) {
    console.log('\nImóvel 0.89.1:', dados.imovel.numeroPlanilha, dados.imovel.arquivo);
  }
  const { tituloAutor11, tituloReu61 } = dados.cabecalho.partesTxt;
  if (tituloAutor11 || tituloReu61) {
    console.log('\nTítulos 1.1/6.1 (texto, não são 151.1.0 nem 90/95):', {
      tituloAutor11,
      tituloReu61,
    });
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
  const { tituloAutor11, tituloReu61, parteClienteNome, parteContraparteNome } =
    dados.cabecalho.partesTxt;
  const nomeAutor = tituloAutor11 ?? parteClienteNome;
  const nomeReu = tituloReu61 ?? parteContraparteNome;
  if (!nomeAutor && !nomeReu) {
    console.log('[partes] Sem títulos 1.1 / 6.1 — ignorado (use import-processo-partes-txt para 90/95).');
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
  if (nomeAutor) plano.push({ nome: nomeAutor, polo: poloCliente, ordem: 0 });
  if (nomeReu) plano.push({ nome: nomeReu, polo: poloContraparte, ordem: 0 });

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

  const clientePorCod8 = new Map();
  const cliente = await resolverClienteFromApi(opts.baseUrl, token, dados.cod8, clientePorCod8);
  if (!cliente?.clientePk) throw new Error('Cliente não encontrado na API');
  const clientePk = cliente.clientePk;

  let imovel = await buscarImovelPorClientePlanilha(
    opts.baseUrl,
    token,
    clientePk,
    reg.numeroPlanilha
  );

  if (imovel?.id && (await jaVinculadoProcesso(opts.baseUrl, token, imovel, proc.id))) {
    return { acao: 'ja_vinculado', imovelId: imovel.id };
  }

  let criado = false;
  if (!imovel) {
    const garantido = await garantirImovelClientePlanilha(
      opts.baseUrl,
      token,
      clientePk,
      reg.numeroPlanilha,
      { observacoes: 'Vínculo Proc/0.89.1 (import-processo-txt).' }
    );
    imovel = garantido.imovel;
    criado = garantido.criado;
  }

  const vinc = await vincularProcessoImovel(
    opts.baseUrl,
    token,
    imovel,
    proc.id,
    'Vínculo Proc/0.89.1 (import-processo-txt).',
    clientePk
  );
  if (!vinc.ok) {
    throw new Error(
      `Vínculo imóvel-processo: ${vinc.status} ${vinc.text?.slice(0, 200)}${vinc.hint ? ` — ${vinc.hint}` : ''}`
    );
  }
  return {
    acao: vinc.idempotente ? 'ja_vinculado' : criado ? 'criado' : 'vinculado',
    imovelId: imovel.id,
    modo: vinc.modo,
  };
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
  /** @type {import('mysql2/promise').Connection | null} */
  let connPessoa = null;
  if (opts.substituirClientePessoa && opts.aplicar) {
    connPessoa = await conectarMysqlVilareal();
  }

  if (!opts.semClientePessoa && dados.pessoaCliente?.pessoaId) {
    try {
      const rCliente = await sincronizarVinculoClientePessoaApi(
        opts.baseUrl,
        token,
        dados.cod8,
        dados.pessoaCliente.pessoaId,
        pessoaPorCod8,
        {
          substituir: opts.substituirClientePessoa,
          conn: connPessoa ?? undefined,
        }
      );
      resultado.etapas.clientePessoa = rCliente;
      console.log('\n[cliente/pessoa 151.1.0]', rCliente);
      if (rCliente.acao === 'divergente_api') {
        console.warn(
          `[cliente] código ${dados.cod8} já vinculado à pessoa ${rCliente.pessoaIdApi} na API; txt indica ${rCliente.pessoaIdTxt} — não alterado.`
        );
      } else if (rCliente.acao === 'atualizado_mysql') {
        const m = rCliente.migracao;
        const migLog = m
          ? `; processos migrados=${m.processosMigrados ?? 0} conflitos=${m.processosConflito ?? 0}`
          : '';
        console.log(
          `[cliente] pessoa atualizada ${rCliente.pessoaIdAnterior} → ${rCliente.pessoaId} (151.1.0)${migLog}`
        );
      } else if (rCliente.acao === 'pessoa_inexistente') {
        console.warn(`[cliente] pessoa ${rCliente.pessoaId} não existe na base`);
      }
    } catch (e) {
      resultado.etapas.clientePessoa = { erro: e?.message || String(e) };
      console.warn('[cliente/pessoa 151.1.0] erro:', e?.message || e);
    }
  } else if (opts.semClientePessoa) {
    resultado.etapas.clientePessoa = 'ignorado_flag';
  } else {
    resultado.etapas.clientePessoa = 'ausente_txt';
  }
  if (connPessoa) await connPessoa.end();

  let proc = await buscarProcesso(opts.baseUrl, token, dados.cod8, dados.numeroInterno, pessoaPorCod8);

  if (!proc?.id) {
    console.log(
      `\n[processo] ${dados.cod8}/${dados.numeroInterno} ausente na API — a criar stub automaticamente…`
    );
    const garantido = await garantirProcessoNaApi(
      opts.baseUrl,
      token,
      dados.cod8,
      dados.numeroInterno,
      pessoaPorCod8
    );
    if (!garantido.ok || !garantido.processo?.id) {
      console.error(
        `\nProcesso ${dados.cod8}/${dados.numeroInterno} não existe na API e não foi possível criar: ${garantido.erro ?? 'erro desconhecido'}\n`
      );
      process.exit(2);
    }
    proc = garantido.processo;
    console.log(`[processo] stub criado na API (id=${proc.id}).`);
  }

  const patchApi = { ...patch };
  if (patchApi._responsavelNome) {
    const usuarios = await fetchUsuariosImportApi(opts.baseUrl, token);
    const mapaResp = construirMapaUsuarioPorNomeResponsavel(usuarios);
    const uid = resolverUsuarioResponsavelId(patchApi._responsavelNome, mapaResp);
    if (uid != null) {
      patchApi.usuarioResponsavelId = uid;
      console.log(`[responsável] ${patchApi._responsavelNome} → usuarioId=${uid}`);
    } else {
      console.warn(
        `[responsável] "${String(patchApi._responsavelNome).slice(0, 80)}" não casou com /api/usuarios — mantém valor atual na API`
      );
    }
    delete patchApi._responsavelNome;
  }

  if (Object.keys(patchApi).length > 0) {
    await atualizarProcessoApi(opts.baseUrl, token, proc, patchApi);
    resultado.etapas.cabecalho = 'atualizado';
    resultado.etapas.statusProcesso = {
      ativo: patchApi.ativo,
      statusBruto: dados.statusProcesso?.statusBruto ?? null,
      temArquivo: Boolean(dados.statusProcesso?.temArquivoStatus),
    };
    console.log('\n[cabeçalho] Processo atualizado na API.');
    if (patchApi.prazoFatal) {
      await upsertPrazoFatalEntidade(opts.baseUrl, token, proc.id, String(patchApi.prazoFatal));
      resultado.etapas.prazoFatal = {
        data: patchApi.prazoFatal,
        fonte: dados.cabecalho.fontes.prazoFatal ?? null,
      };
      console.log(`[prazo fatal] ${patchApi.prazoFatal} (145.1 canónico)`);
    }
    if (dados.statusProcesso) {
      console.log(
        `[status] ativo=${patchApi.ativo} (txt: ${JSON.stringify(dados.statusProcesso.statusBruto ?? 'ausente/vazio')})`
      );
    }
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
