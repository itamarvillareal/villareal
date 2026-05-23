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
  const sigla = String(uf || 'GO').trim().toUpperCase() || 'GO';
  const competenciaUpper = String(competencia || '').toUpperCase();

  const mapa = [
    ['JUIZADO ESPECIAL', `MERITÍSSIMO JUÍZO DO JUIZADO ESPECIAL CÍVEL DA COMARCA DE ${cid.toUpperCase()} - ${sigla}`],
    ['VARA CÍVEL', `MERITÍSSIMO JUÍZO DA VARA CÍVEL DA COMARCA DE ${cid.toUpperCase()} - ${sigla}`],
    ['VARA DE FAMÍLIA', `MERITÍSSIMO JUÍZO DA VARA DE FAMÍLIA E SUCESSÕES DA COMARCA DE ${cid.toUpperCase()} - ${sigla}`],
    ['VARA DO TRABALHO', `MERITÍSSIMO JUÍZO DA VARA DO TRABALHO DE ${cid.toUpperCase()} - ${sigla}`],
    ['VARA CRIMINAL', `MERITÍSSIMO JUÍZO DA VARA CRIMINAL DA COMARCA DE ${cid.toUpperCase()} - ${sigla}`],
  ];

  for (const [chave, valor] of mapa) {
    if (competenciaUpper.includes(chave)) {
      const matchLista = ENDERECAMENTOS.find((e) => e.toUpperCase().includes(chave.replace('VARA ', '')));
      if (matchLista && cid.toUpperCase() === 'ANÁPOLIS' && sigla === 'GO') {
        return matchLista;
      }
      return valor;
    }
  }

  if (competenciaUpper.trim()) {
    return `MERITÍSSIMO JUÍZO ${competenciaUpper} DA COMARCA DE ${cid.toUpperCase()} - ${sigla}`;
  }

  const padraoAnapolis = ENDERECAMENTOS.find((e) => e.includes('JUIZADO ESPECIAL'));
  if (padraoAnapolis && cid.toUpperCase() === 'ANÁPOLIS' && sigla === 'GO') {
    return padraoAnapolis;
  }

  return `MERITÍSSIMO JUÍZO DA COMARCA DE ${cid.toUpperCase()} - ${sigla}`;
}

export function formatarCidadeEstado(cidade, uf) {
  const sigla = String(uf || 'GO').trim().toUpperCase() || 'GO';
  const nomeEstado = ESTADOS_NOME[sigla] || sigla;
  const cid = String(cidade || 'Anápolis').trim() || 'Anápolis';
  return `${cid}, estado de ${nomeEstado}`;
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

  const end = resolveSelectInicial(dadosProcesso.enderecamento, ENDERECAMENTOS);
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
