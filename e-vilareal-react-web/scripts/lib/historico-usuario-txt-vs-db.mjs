/**
 * Compara responsável do histórico (txt tipo 17) com processo_andamento na VPS.
 */

import {
  chaveAndamentoEstrita,
  chaveAndamentoPorDataDia,
  chaveDetalheParaDedupe,
  chaveTituloParaDedupe,
} from './chaves-dedupe-andamento.mjs';
import {
  montarCamposAndamentoFromInformacaoBruta,
  normalizarInformacaoHistorico,
} from './historico-informacao-import.mjs';
import { movimentoEmFromHistoricoLocal } from './historico-movimento-em.mjs';
import { normalizarResponsavelHistorico } from './historico-responsavel-import.mjs';
import { construirMapaUsuarioPorNomeResponsavel, resolverUsuarioResponsavelId } from './responsavel-usuario-import.mjs';

/** Espelha {@link extrairNomeConsultorDeDetalhe} do processosRepository. */
export function extrairNomeConsultorDeDetalhe(detalhe) {
  const s = String(detalhe ?? '').trim();
  if (!s) return '';
  for (const line of s.split(/\r?\n/)) {
    const t = line.trim();
    const m = /^\s*Consultor:\s*(.+)$/i.exec(t);
    if (m) return m[1].trim();
  }
  const m2 = /Consultor:\s*([^\r\n]+)/i.exec(s);
  return m2 ? m2[1].trim() : '';
}

/** Espelha {@link extrairResponsavelPlanilhaDeDetalhe}. */
export function extrairResponsavelPlanilhaDeDetalhe(detalhe, tituloPreenchido) {
  if (!tituloPreenchido) return '';
  const consultor = extrairNomeConsultorDeDetalhe(detalhe);
  if (consultor) return consultor;
  const s = String(detalhe ?? '').trim();
  if (!s) return '';
  const lines = s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  if (lines.length !== 1) return '';
  const line = lines[0];
  if (/^\s*Consultor:/i.test(line)) return '';
  if (line.length > 120) return '';
  return line;
}

function normUsuario(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/**
 * @param {{ titulo?: string|null, detalhe?: string|null, usuario_id?: number|null, usuario_nome?: string|null, usuario_login?: string|null, usuario_apelido?: string|null }} row
 */
export function extrairUsuarioExibicaoDb(row) {
  const tituloCampo = row?.titulo ?? '';
  const det = row?.detalhe != null ? String(row.detalhe) : '';
  const tituloPreenchido = String(tituloCampo ?? '').trim().length > 0;
  const nome = String(row?.usuario_nome ?? row?.usuario_apelido ?? '').trim();
  const login = String(row?.usuario_login ?? '').trim();
  const responsavelPlanilha = extrairResponsavelPlanilhaDeDetalhe(det, tituloPreenchido);
  return normUsuario(nome || login || responsavelPlanilha);
}

/**
 * @param {import('./historico-local-txt-iterar.mjs').EntradaHistoricoLocal} entrada
 */
export function montarEsperadoHistoricoFromTxt(entrada) {
  const responsavelNorm = normalizarResponsavelHistorico(entrada.usuarioBruto);
  const campos = montarCamposAndamentoFromInformacaoBruta(entrada.informacao, responsavelNorm);
  const movimentoEm = movimentoEmFromHistoricoLocal(
    entrada.dataBruta,
    entrada.yyyyPasta,
    entrada.mmPasta,
    entrada.infoArquivoAbs,
  );
  return {
    indiceTxt: entrada.indice,
    responsavelNorm,
    titulo: campos.titulo,
    detalhe: campos.detalhe,
    movimentoEm,
    chaveEstrita: movimentoEm ? chaveAndamentoEstrita(movimentoEm, campos.titulo) : null,
    chaveDataDia: movimentoEm ? chaveAndamentoPorDataDia(campos.titulo, movimentoEm) : null,
  };
}

/**
 * @param {Map<string, ReturnType<typeof montarEsperadoHistoricoFromTxt>>} mapaEstrito
 * @param {Map<string, ReturnType<typeof montarEsperadoHistoricoFromTxt>[]>} mapaDataDia
 * @param {{ movimento_em?: string|null, titulo?: string|null }} andamento
 */
export function resolverEsperadoTxtParaAndamento(mapaEstrito, mapaDataDia, andamento) {
  const mov = andamento.movimento_em;
  const titulo = andamento.titulo;
  const chave = chaveAndamentoEstrita(mov, titulo);
  if (mapaEstrito.has(chave)) return { esperado: mapaEstrito.get(chave), match: 'estrita' };

  const chaveDia = chaveAndamentoPorDataDia(titulo, mov);
  const candidatos = mapaDataDia.get(chaveDia) ?? [];
  if (candidatos.length === 1) return { esperado: candidatos[0], match: 'data_dia' };

  const tituloNorm = chaveTituloParaDedupe(titulo);
  const porPrefixo = candidatos.filter((c) => {
    const tTxt = chaveTituloParaDedupe(c.titulo);
    return tTxt.startsWith(tituloNorm) || tituloNorm.startsWith(tTxt);
  });
  if (porPrefixo.length === 1) return { esperado: porPrefixo[0], match: 'prefixo_titulo' };

  return { esperado: null, match: null };
}

/**
 * @param {ReturnType<typeof montarEsperadoHistoricoFromTxt>} esperado
 * @param {{ titulo?: string|null, detalhe?: string|null, usuario_id?: number|null, usuario_nome?: string|null, usuario_login?: string|null, usuario_apelido?: string|null }} dbRow
 * @param {Map<string, number>} mapaUsuarios
 */
export function diagnosticarAndamentoUsuario(esperado, dbRow, mapaUsuarios) {
  /** @type {string[]} */
  const motivos = [];

  if (!esperado?.responsavelNorm) {
    return { precisaAtualizacao: false, motivos: ['txt_sem_responsavel'], patch: null };
  }

  const usuarioDb = extrairUsuarioExibicaoDb(dbRow);
  const usuarioTxt = normUsuario(esperado.responsavelNorm);
  const usuarioIdNovo = resolverUsuarioResponsavelId(esperado.responsavelNorm, mapaUsuarios);
  const detalheNovo = esperado.detalhe ?? null;
  const detalheAntigo = dbRow.detalhe ?? null;

  if (!usuarioDb) motivos.push('sem_usuario_db');
  else if (usuarioDb !== usuarioTxt) motivos.push('usuario_divergente');

  const detAnt = chaveDetalheParaDedupe(detalheAntigo);
  const detNovo = chaveDetalheParaDedupe(detalheNovo);
  if (detalheNovo && detAnt !== detNovo) {
    if (!detAnt && detNovo) motivos.push('detalhe_ausente');
    else motivos.push('detalhe_divergente');
  }

  if (usuarioIdNovo != null && Number(dbRow.usuario_id) !== Number(usuarioIdNovo)) {
    motivos.push('usuario_id_ausente_ou_errado');
  }

  const precisaAtualizacao =
    motivos.includes('sem_usuario_db') ||
    motivos.includes('usuario_divergente') ||
    motivos.includes('detalhe_ausente') ||
    motivos.includes('detalhe_divergente') ||
    motivos.includes('usuario_id_ausente_ou_errado');

  if (!precisaAtualizacao) {
    return { precisaAtualizacao: false, motivos: ['ok'], patch: null };
  }

  return {
    precisaAtualizacao: true,
    motivos,
    patch: {
      usuario_id_novo: usuarioIdNovo,
      detalhe_novo: detalheNovo,
      usuario_txt: esperado.responsavelNorm,
      indice_txt: esperado.indiceTxt,
    },
  };
}

/**
 * @param {Iterable<import('./historico-local-txt-iterar.mjs').EntradaHistoricoLocal>} entradas
 */
export function indexarEsperadosTxt(entradas) {
  /** @type {Map<string, ReturnType<typeof montarEsperadoHistoricoFromTxt>>} */
  const mapaEstrito = new Map();
  /** @type {Map<string, ReturnType<typeof montarEsperadoHistoricoFromTxt>[]>} */
  const mapaDataDia = new Map();

  for (const entrada of entradas) {
    const esperado = montarEsperadoHistoricoFromTxt(entrada);
    if (!esperado.chaveEstrita) continue;
    mapaEstrito.set(esperado.chaveEstrita, esperado);
    const lista = mapaDataDia.get(esperado.chaveDataDia) ?? [];
    lista.push(esperado);
    mapaDataDia.set(esperado.chaveDataDia, lista);
  }
  return { mapaEstrito, mapaDataDia };
}

/**
 * @param {Array<{ login?: string, nome?: string, nomePessoa?: string, apelido?: string, ativo?: boolean, id: number }>} usuarios
 */
export function mapaUsuariosFromApi(usuarios) {
  return construirMapaUsuarioPorNomeResponsavel(usuarios);
}
