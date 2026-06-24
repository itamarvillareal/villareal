import { request } from '../api/httpClient.js';
import { ENDERECAMENTOS, TIPOS_PECA, CIDADE_ESTADO_PADRAO } from '../pages/documentos/constants.js';
import {
  primeiraPessoaIdParteCliente,
  primeiraPessoaIdParteOposta,
  poloJuridicoEscritorioEhAutor,
  textosPartesFromListaPartesApi,
} from '../data/partesLadoEscritorio.js';
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

/** @deprecated Prefer {@link textosPartesFromListaPartesApi} com papel_cliente do processo. */
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

export function poloEhAutorProcesso(polo) {
  const p = String(polo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  return p.includes('AUTOR') || p.includes('REQUERENTE');
}

export function poloEhReuProcesso(polo) {
  const p = String(polo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  return p.includes('REU') || p.includes('REQUERIDO');
}

export function inferirEnderecamento(competencia, cidade, uf) {
  const cid = String(cidade || 'Anápolis').trim() || 'Anápolis';
  const cidUpper = cid.toUpperCase();
  const sigla = String(uf || 'GO').trim().toUpperCase() || 'GO';
  const competenciaUpper = String(competencia || '').trim().toUpperCase();

  if (!competenciaUpper) {
    return `MERITÍSSIMO JUÍZO DA COMARCA DE ${cidUpper} - ${sigla}`;
  }

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

async function montarNomeQualificacaoJuridica(parte, textoFallback) {
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

function juntarNomesPartes(partes) {
  return (partes || [])
    .map((p) => String(p.nomeExibicao || p.nomeLivre || '').trim())
    .filter(Boolean)
    .join(' e ');
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

  let partes = ctx.partesApi;
  if (!Array.isArray(partes) && ctx.processoApiId) {
    partes = await listarPartesProcesso(ctx.processoApiId);
  }
  partes = Array.isArray(partes) ? partes : [];

  const textosPartes = textosPartesFromListaPartesApi(partes, papelUi);
  const textoParteCliente = String(
    ctx.textoParteCliente ?? ctx.parteCliente ?? textosPartes.parteCliente ?? '',
  ).trim();
  const textoParteOposta = String(
    ctx.textoParteOposta ?? ctx.parteOposta ?? textosPartes.parteOposta ?? '',
  ).trim();

  const partesAutor = partes.filter((p) => poloEhAutorProcesso(p.polo));
  const partesReu = partes.filter((p) => poloEhReuProcesso(p.polo));

  const autor = await montarNomeQualificacaoJuridica(partesAutor[0], textoParteOposta);
  const reu = await montarNomeQualificacaoJuridica(partesReu[0], textoParteCliente);

  const nomeAutor = juntarNomesPartes(partesAutor).toUpperCase() || autor.nome;
  const nomeReu = juntarNomesPartes(partesReu).toUpperCase() || reu.nome;
  const qualificacaoAutor = autor.qualificacao;
  const qualificacaoReu = reu.qualificacao;

  const enderecamento = inferirEnderecamento(competencia, cidade, uf);
  const cidadeEstado = formatarCidadeEstado(cidade, uf);

  const pessoaIdOutorgante = primeiraPessoaIdParteCliente(partes, papelUi);
  const pessoaIdOposta = primeiraPessoaIdParteOposta(partes, papelUi);
  const qualificacaoParteCliente = pessoaIdOutorgante
    ? await buscarQualificacaoCompleta(pessoaIdOutorgante)
    : '';
  const qualificacaoParteOposta = pessoaIdOposta
    ? await buscarQualificacaoCompleta(pessoaIdOposta)
    : '';
  const nomeOutorgante = textoParteCliente.toUpperCase();

  const nomeLocador = juntarNomesPartes(partesAutor).toUpperCase() || nomeAutor;
  const nomeLocatarios = juntarNomesPartes(partesReu).toUpperCase() || nomeReu;

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
    nomeOutorgante,
    nomeLocador,
    nomeLocatarios,
    codigoCliente: ctx.codigoCliente,
    numeroInterno: ctx.numeroInterno ?? ctx.processo,
    processoApiId: ctx.processoApiId ?? null,
    parteCliente: textoParteCliente,
    parteOposta: textoParteOposta,
    qualificacaoParteCliente,
    qualificacaoParteOposta,
    papelParte: papelUi,
  };
}

function escaparHtmlBasico(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Trecho «na ação que move…» / «na ação que lhe move…» conforme o polo da parte cliente. */
export function montarTrechoAcaoPreambuloHtml(papelParte, parteOposta) {
  const opostaNome = String(parteOposta || 'XXXXXXXXXXXX').trim().toUpperCase();
  const opostaHtml = `<strong>${escaparHtmlBasico(opostaNome)}</strong>`;
  if (poloJuridicoEscritorioEhAutor(papelParte)) {
    return `na ação que move em face de ${opostaHtml}`;
  }
  return `na ação que lhe move ${opostaHtml}`;
}

/** Preâmbulo HTML sugerido para o modo manual (qualificação da parte cliente + trecho da ação). */
export function montarPreambuloSugerido(dadosProcesso) {
  if (!dadosProcesso) return '';
  const interlocutoria = Boolean(String(dadosProcesso.numeroProcesso ?? '').trim());
  const nomesAutor = String(dadosProcesso.nomeAutor || dadosProcesso.parteCliente || '').trim();
  const nomesReu = String(dadosProcesso.nomeReu || dadosProcesso.parteOposta || '').trim();
  if (!nomesAutor && !nomesReu) return '';

  if (interlocutoria) {
    return montarPreambuloInterlocutoria(dadosProcesso.papelParte, nomesAutor, nomesReu);
  }

  const nomeCliente = String(dadosProcesso.parteCliente || dadosProcesso.nomeOutorgante || '').trim();
  const parteOposta = String(dadosProcesso.parteOposta || '').trim();
  const qual = String(dadosProcesso.qualificacaoParteCliente || '').trim();
  const qualSuffix = qual ? escaparHtmlBasico(qual) : 'brasileiro(a)...';
  const nomeClienteHtml = `<strong>${escaparHtmlBasico(
    (nomeCliente || 'FULANO').toUpperCase(),
  )}</strong>`;
  const trechoAcao = montarTrechoAcaoPreambuloHtml(dadosProcesso.papelParte, parteOposta);

  return `<p>${nomeClienteHtml}, ${qualSuffix}, vem, respeitosamente, perante Vossa Excelência, ${trechoAcao}, requerer o que segue.</p>`;
}

function montarPreambuloInterlocutoria(papelParte, nomesAutor, nomesReu) {
  const autoresHtml = `<strong>${escaparHtmlBasico(nomesAutor.toUpperCase())}</strong>, já devidamente qualificado(s)`;
  const reusHtml = `<strong>${escaparHtmlBasico(nomesReu.toUpperCase())}</strong>, já devidamente qualificado(s)`;
  if (poloJuridicoEscritorioEhAutor(papelParte)) {
    return `<p>${autoresHtml}, vem, respeitosamente, perante Vossa Excelência, na ação que move em face de ${reusHtml}, requerer o que segue.</p>`;
  }
  return `<p>${reusHtml}, vem, respeitosamente, perante Vossa Excelência, na ação que lhe move ${autoresHtml}, requerer o que segue.</p>`;
}

function mapearEnderecamentoParaForm(enderecamento) {
  const end = resolveSelectExato(enderecamento, ENDERECAMENTOS);
  return {
    enderecamentoSelect: end.select,
    enderecamentoOutro: end.outro,
  };
}

export function mapearDadosProcessoParaFormIA(dadosProcesso) {
  if (!dadosProcesso) return estadoInicialFormVazio();

  const tipo = resolveSelectInicial(dadosProcesso.tipoPeca, TIPOS_PECA);

  return {
    ...mapearEnderecamentoParaForm(dadosProcesso.enderecamento),
    numeroProcesso: dadosProcesso.numeroProcesso || '',
    tipoPeca: tipo.select,
    tipoPecaOutro: tipo.outro,
    nomeAutor: dadosProcesso.nomeAutor || '',
    qualificacaoAutor: dadosProcesso.qualificacaoAutor || '',
    nomeReu: dadosProcesso.nomeReu || '',
    qualificacaoReu: dadosProcesso.qualificacaoReu || '',
    fatos: dadosProcesso.fatos || '',
    valorCausa: dadosProcesso.valorCausa || '',
    cidadeEstado: dadosProcesso.cidadeEstado || CIDADE_ESTADO_PADRAO,
  };
}

export function mapearDadosProcessoParaFormManual(dadosProcesso) {
  if (!dadosProcesso) return estadoInicialFormManualVazio();

  return {
    ...mapearEnderecamentoParaForm(dadosProcesso.enderecamento),
    numeroProcesso: dadosProcesso.numeroProcesso || '',
    preambulo: montarPreambuloSugerido(dadosProcesso),
    secoes: [
      { titulo: 'DOS FATOS', conteudo: '' },
      { titulo: 'DO DIREITO', conteudo: '' },
    ],
    pedidos: [''],
    cidadeEstado: dadosProcesso.cidadeEstado || CIDADE_ESTADO_PADRAO,
  };
}

function estadoInicialFormVazio() {
  return {
    enderecamentoSelect: '',
    enderecamentoOutro: '',
    numeroProcesso: '',
    tipoPeca: '',
    tipoPecaOutro: '',
    nomeAutor: '',
    qualificacaoAutor: '',
    nomeReu: '',
    qualificacaoReu: '',
    fatos: '',
    valorCausa: '',
    cidadeEstado: CIDADE_ESTADO_PADRAO,
  };
}

function estadoInicialFormManualVazio() {
  return {
    enderecamentoSelect: '',
    enderecamentoOutro: '',
    numeroProcesso: '',
    preambulo: '',
    secoes: [
      { titulo: 'DOS FATOS', conteudo: '' },
      { titulo: 'DO DIREITO', conteudo: '' },
    ],
    pedidos: [''],
    cidadeEstado: CIDADE_ESTADO_PADRAO,
  };
}
