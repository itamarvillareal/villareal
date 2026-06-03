import { request } from '../api/httpClient.js';
import { ENDERECAMENTOS, TIPOS_PECA, CIDADE_ESTADO_PADRAO } from '../pages/documentos/constants.js';
import { listarPartesProcesso, papelParteUiParaApi } from '../repositories/processosRepository.js';

const ESTADOS_NOME = {
  GO: 'Goiás',
  SP: 'São Paulo',
  MG: 'Minas Gerais',
  RJ: 'Rio de Janeiro',
  BA: 'Bahia',
  PR: 'Paraná',
  RS: 'Rio Grande do Sul',
  PE: 'Pernambuco',
  CE: 'Ceará',
  PA: 'Pará',
  SC: 'Santa Catarina',
  MA: 'Maranhão',
  AM: 'Amazonas',
  ES: 'Espírito Santo',
  PB: 'Paraíba',
  RN: 'Rio Grande do Norte',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  DF: 'Distrito Federal',
  AL: 'Alagoas',
  PI: 'Piauí',
  SE: 'Sergipe',
  RO: 'Rondônia',
  TO: 'Tocantins',
  AC: 'Acre',
  AP: 'Amapá',
  RR: 'Roraima',
};

export function poloEhLadoCliente(polo) {
  const poloNorm = String(polo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  return (
    poloNorm.includes('AUTOR') ||
    poloNorm.includes('REQUERENTE') ||
    poloNorm.includes('CLIENTE')
  );
}

export function inferirEnderecamento(competencia, cidade, uf) {
  const cid = String(cidade || 'Anápolis').trim() || 'Anápolis';
  const cidUpper = cid.toUpperCase();
  const sigla = String(uf || 'GO').trim().toUpperCase() || 'GO';
  const competenciaUpper = String(competencia || '').trim().toUpperCase();

  if (!competenciaUpper) {
    return `MERITÍSSIMO JUÍZO DA COMARCA DE ${cidUpper} - ${sigla}`;
  }

  // Constrói o endereçamento preservando EXATAMENTE a competência do processo
  // (incluindo o número/ordinal, ex.: "1º JUIZADO ESPECIAL CÍVEL").
  const ehJuizado = competenciaUpper.includes('JUIZADO');
  const ehTrabalho = competenciaUpper.includes('TRABALHO');
  const artigo = ehJuizado ? 'DO' : 'DA';
  const local = ehTrabalho ? `DE ${cidUpper}` : `DA COMARCA DE ${cidUpper}`;
  return `MERITÍSSIMO JUÍZO ${artigo} ${competenciaUpper} ${local} - ${sigla}`;
}

export function formatarCidadeEstado(cidade, uf) {
  const sigla = String(uf || 'GO').trim().toUpperCase() || 'GO';
  const nomeEstado = ESTADOS_NOME[sigla] || sigla;
  const cid = String(cidade || 'Anápolis').trim() || 'Anápolis';
  return `${cid}, estado de ${nomeEstado}`;
}

const MESES_PT = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

/** Extrai YYYY-MM-DD de «Anápolis, estado de Goiás, 01 de junho de 2026». */
export function extrairDataIsoDeLocalData(texto) {
  const m = String(texto ?? '').match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
  if (!m) return null;
  const dia = Number.parseInt(m[1], 10);
  const mes = MESES_PT[m[2].toLowerCase()];
  const ano = Number.parseInt(m[3], 10);
  if (!mes || !Number.isFinite(dia) || !Number.isFinite(ano) || dia < 1 || dia > 31) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function resolveSelectInicial(valor, opcoes) {
  const v = String(valor ?? '').trim();
  if (!v) return { select: '', outro: '' };
  const match = opcoes.find((o) => o.toLowerCase() === v.toLowerCase());
  if (match) return { select: match, outro: '' };
  const parcial = opcoes.find((o) => v.toLowerCase().includes(o.toLowerCase().slice(0, 20)));
  if (parcial) return { select: parcial, outro: '' };
  return { select: '__outro__', outro: v };
}

/**
 * Resolve o valor inicial de um select aceitando apenas correspondência EXATA com
 * uma das opções pré-definidas; caso contrário usa o campo "Outro" com o texto original.
 * Usado no endereçamento, onde várias opções compartilham o mesmo prefixo e o match
 * parcial levaria à sugestão de uma comarca/juízo errados.
 */
export function resolveSelectExato(valor, opcoes) {
  const v = String(valor ?? '').trim();
  if (!v) return { select: '', outro: '' };
  const match = opcoes.find((o) => o.toLowerCase() === v.toLowerCase());
  if (match) return { select: match, outro: '' };
  return { select: '__outro__', outro: v };
}

export async function buscarQualificacaoCompleta(pessoaId) {
  const id = Number(pessoaId);
  if (!Number.isFinite(id) || id < 1) return '';

  try {
    const data = await request(`/api/pessoas/${id}/qualificacao-juridica`);
    return data?.qualificacao || '';
  } catch (error) {
    console.error('Erro ao buscar qualificação:', error);
    return '';
  }
}

async function montarParteAutorReu(parte, textoFallback) {
  const nome = String(parte?.nomeExibicao || parte?.nomeLivre || textoFallback || '').trim();
  const pessoaId = Number(parte?.pessoaId);
  let qualificacao = '';
  if (Number.isFinite(pessoaId) && pessoaId > 0) {
    qualificacao = await buscarQualificacaoCompleta(pessoaId);
  }
  return {
    nome: nome.toUpperCase(),
    qualificacao,
  };
}

function separarPartesApi(partes) {
  const cliente = [];
  const oposta = [];
  for (const p of partes || []) {
    if (poloEhLadoCliente(p.polo)) cliente.push(p);
    else oposta.push(p);
  }
  return { partesCliente: cliente, partesOposta: oposta };
}

/**
 * @param {object} ctx — snapshot do formulário Processos
 */
export async function montarDadosParaDocumentoFromProcesso(ctx) {
  const cidade = String(ctx.cidade ?? 'Anápolis').trim() || 'Anápolis';
  const uf = String(ctx.estado ?? 'GO').trim().toUpperCase() || 'GO';
  const competencia = String(ctx.competencia ?? '').trim();
  const naturezaAcao = String(ctx.naturezaAcao ?? '').trim();
  const numeroProcesso =
    String(ctx.numeroProcessoNovo ?? '').trim() ||
    String(ctx.numeroProcessoVelho ?? '').trim() ||
    '';
  const valorCausa = String(ctx.valorCausa ?? '').trim();
  const observacao = String(ctx.observacao ?? '').trim();
  const papelUi = String(ctx.papelParte ?? 'requerente').toLowerCase();
  const papelCliente = papelParteUiParaApi(papelUi) || 'REQUERENTE';
  const clienteEhRequerente = papelCliente === 'REQUERENTE';

  let partes = ctx.partesApi;
  if (!Array.isArray(partes) && ctx.processoApiId) {
    partes = await listarPartesProcesso(ctx.processoApiId);
  }
  partes = Array.isArray(partes) ? partes : [];

  const { partesCliente, partesOposta } = separarPartesApi(partes);

  const textoCliente = String(ctx.textoParteCliente ?? ctx.parteCliente ?? '').trim();
  const textoOposta = String(ctx.textoParteOposta ?? ctx.parteOposta ?? '').trim();

  const principalCliente = partesCliente[0] || null;
  const principalOposta = partesOposta[0] || null;

  let nomeAutor = '';
  let qualificacaoAutor = '';
  let nomeReu = '';
  let qualificacaoReu = '';

  if (clienteEhRequerente) {
    const autor = await montarParteAutorReu(principalCliente, textoCliente);
    const reu = await montarParteAutorReu(principalOposta, textoOposta);
    nomeAutor = autor.nome;
    qualificacaoAutor = autor.qualificacao;
    nomeReu = reu.nome;
    qualificacaoReu = reu.qualificacao;
  } else {
    const autor = await montarParteAutorReu(principalOposta, textoOposta);
    const reu = await montarParteAutorReu(principalCliente, textoCliente);
    nomeAutor = autor.nome;
    qualificacaoAutor = autor.qualificacao;
    nomeReu = reu.nome;
    qualificacaoReu = reu.qualificacao;
  }

  const enderecamento = inferirEnderecamento(competencia, cidade, uf);
  const cidadeEstado = formatarCidadeEstado(cidade, uf);

  const pessoaIdOutorgante =
    principalCliente?.pessoaId != null && Number(principalCliente.pessoaId) > 0
      ? Number(principalCliente.pessoaId)
      : null;

  return {
    enderecamento,
    numeroProcesso,
    tipoPeca: naturezaAcao,
    nomeAutor,
    qualificacaoAutor,
    nomeReu,
    qualificacaoReu,
    fatos: observacao,
    valorCausa,
    cidadeEstado,
    pessoaIdOutorgante,
    nomeOutorgante: clienteEhRequerente ? nomeAutor : nomeReu,
    codigoCliente: ctx.codigoCliente,
    numeroInterno: ctx.numeroInterno ?? ctx.processo,
  };
}

export function mapearDadosProcessoParaFormIA(dadosProcesso) {
  if (!dadosProcesso) return estadoInicialFormVazio();

  const end = resolveSelectExato(dadosProcesso.enderecamento, ENDERECAMENTOS);
  const tipo = resolveSelectInicial(dadosProcesso.tipoPeca, TIPOS_PECA);

  return {
    enderecamentoSelect: end.select,
    enderecamentoOutro: end.outro,
    numeroProcesso: dadosProcesso.numeroProcesso || '',
    nomeAutor: dadosProcesso.nomeAutor || '',
    qualificacaoAutor: dadosProcesso.qualificacaoAutor || '',
    nomeReu: dadosProcesso.nomeReu || '',
    qualificacaoReu: dadosProcesso.qualificacaoReu || '',
    tipoPecaSelect: tipo.select,
    tipoPecaOutro: tipo.outro,
    fatos: dadosProcesso.fatos || '',
    valorCausa: dadosProcesso.valorCausa || '',
    fundamentacaoAdicional: '',
    modeloBase: '',
    instrucoesAdicionais: '',
    pedidosEspecificos: [''],
    cidadeEstado: dadosProcesso.cidadeEstado || CIDADE_ESTADO_PADRAO,
  };
}

function estadoInicialFormVazio() {
  return {
    enderecamentoSelect: '',
    enderecamentoOutro: '',
    numeroProcesso: '',
    nomeAutor: '',
    qualificacaoAutor: '',
    nomeReu: '',
    qualificacaoReu: '',
    tipoPecaSelect: '',
    tipoPecaOutro: '',
    fatos: '',
    valorCausa: '',
    fundamentacaoAdicional: '',
    modeloBase: '',
    instrucoesAdicionais: '',
    pedidosEspecificos: [''],
    cidadeEstado: CIDADE_ESTADO_PADRAO,
  };
}
