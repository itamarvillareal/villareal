/**
 * Mapeamento de campos editáveis do Relatório de Processos → payload da API (cabecalho).
 */
import { parseValorMonetarioBr } from '../utils/parseValorMonetarioBr.js';
import { normalizarTipoAudienciaCanonico } from './processosDadosRelatorio.js';

/** Campos da grade que não são gravados na API (identificadores, derivados ou mock). */
export const CAMPOS_RELATORIO_SEM_PERSISTENCIA_API = new Set([
  'codCliente',
  'proc',
  'cliente',
  'codigoClienteProcesso',
  'numeroProcessoInterno',
  'clienteCadastroProcesso',
  'parteCliente',
  'parteOposta',
  'parteRequerenteTexto',
  'parteRevelTexto',
  'parteRequeridoTexto',
  'ultimoAndamento',
  'dataConsulta',
  'ultimoHistoricoInfo',
  'ultimoHistoricoData',
  'ultimoHistoricoUsuario',
  'inRequerente',
  'lmv',
  'inv',
  'consultas',
  'cepReu',
  'imovelIdVinculado',
  'unidadeImovel',
  'enderecoImovel',
  'condominioImovel',
  'tituloPessoa1Reu',
  'nPessoa1Reu',
  'nEndPessoa1Reu',
  'tituloPessoa1Autor',
  'nPessoa1Autor',
  'nEndPessoa1Autor',
  'periodicidadeConsulta',
]);

/** fieldKey do relatório → chave em {@link montarPayloadSalvarCabecalho}. */
const MAP_CAMPO_PARA_PAYLOAD = {
  unidade: 'unidade',
  numeroProcesso: 'numeroProcessoNovo',
  numeroProcessoNovo: 'numeroProcessoNovo',
  numeroProcessoVelho: 'numeroProcessoVelho',
  observacaoProcesso: 'observacao',
  observacaoCadastroProcesso: 'observacao',
  proximaConsulta: 'proximaConsultaData',
  proximaConsultaCalculada: 'proximaConsultaData',
  prazoFatal: 'prazoFatal',
  prazoFatalCadastroProcesso: 'prazoFatal',
  fase: 'faseSelecionada',
  faseCadastroProcesso: 'faseSelecionada',
  competencia: 'competencia',
  competenciaCadastroProcesso: 'competencia',
  descricaoAcao: 'naturezaAcao',
  naturezaAcaoProcesso: 'naturezaAcao',
  estadoProcesso: 'estado',
  cidadeProcesso: 'cidade',
  dataProtocolo: 'dataProtocolo',
  tramitacao: 'tramitacao',
  valorCausaProcesso: 'valorCausa',
  pastaArquivoProcesso: 'pasta',
  audienciaDataProcesso: 'audienciaData',
  dataAudiencia: 'audienciaData',
  audienciaHoraProcesso: 'audienciaHora',
  horaAudiencia: 'audienciaHora',
  tipoAudienciaProcesso: 'audienciaTipo',
  tipoAudiencia: 'audienciaTipo',
  observacaoFase: 'faseCampo',
  responsavelProcesso: 'responsavel',
  consultor: 'responsavel',
};

function simNaoParaBoolean(texto) {
  const t = String(texto ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!t) return null;
  if (t === 'sim' || t === 's' || t === 'true' || t === '1') return true;
  if (t === 'nao' || t === 'n' || t === 'false' || t === '0') return false;
  return null;
}

function statusAtivoTextoParaBoolean(texto) {
  const t = String(texto ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!t) return null;
  if (t.startsWith('ativ')) return true;
  if (t.startsWith('inativ')) return false;
  return null;
}

/**
 * @param {string} fieldKey
 * @returns {'cabecalho'|'ativo'|'consultaAutomatica'|null}
 */
export function tipoPersistenciaCampoRelatorio(fieldKey) {
  if (CAMPOS_RELATORIO_SEM_PERSISTENCIA_API.has(fieldKey)) return null;
  if (fieldKey === 'statusAtivoTexto') return 'ativo';
  if (fieldKey === 'consultaAutomaticaTexto') return 'consultaAutomatica';
  if (MAP_CAMPO_PARA_PAYLOAD[fieldKey]) return 'cabecalho';
  return null;
}

/**
 * @param {string} fieldKey
 * @param {string} valorBruto
 * @returns {Record<string, unknown>|null} patch parcial para salvarCabecalhoProcesso
 */
export function montarPatchCabecalhoCampoRelatorio(fieldKey, valorBruto) {
  const payloadKey = MAP_CAMPO_PARA_PAYLOAD[fieldKey];
  if (!payloadKey) return null;
  const valor = String(valorBruto ?? '').trim();

  if (payloadKey === 'valorCausa') {
    const n = parseValorMonetarioBr(valor);
    return { valorCausaNumero: n };
  }
  if (payloadKey === 'audienciaTipo') {
    return { audienciaTipo: normalizarTipoAudienciaCanonico(valor) || null };
  }
  if (payloadKey === 'naturezaAcao') {
    return { naturezaAcao: valor || null, descricaoAcao: valor || null };
  }

  return { [payloadKey]: valor || null };
}

export function parseStatusAtivoRelatorio(valorBruto) {
  return statusAtivoTextoParaBoolean(valorBruto);
}

export function parseConsultaAutomaticaRelatorio(valorBruto) {
  return simNaoParaBoolean(valorBruto);
}

/** Chaves equivalentes na linha crua do relatório (após «Atualizar relatório»). */
export function chavesLinhaBaseRelatorio(fieldKey) {
  const out = new Set([fieldKey]);
  if (fieldKey === 'numeroProcessoNovo') out.add('numeroProcesso');
  if (fieldKey === 'numeroProcesso') out.add('numeroProcessoNovo');
  if (fieldKey === 'observacaoCadastroProcesso') out.add('observacaoProcesso');
  if (fieldKey === 'observacaoProcesso') out.add('observacaoCadastroProcesso');
  if (fieldKey === 'faseCadastroProcesso') out.add('fase');
  if (fieldKey === 'fase') out.add('faseCadastroProcesso');
  if (fieldKey === 'competenciaCadastroProcesso') out.add('competencia');
  if (fieldKey === 'competencia') out.add('competenciaCadastroProcesso');
  if (fieldKey === 'prazoFatalCadastroProcesso') out.add('prazoFatal');
  if (fieldKey === 'prazoFatal') out.add('prazoFatalCadastroProcesso');
  if (fieldKey === 'proximaConsultaCalculada') out.add('proximaConsulta');
  if (fieldKey === 'proximaConsulta') out.add('proximaConsultaCalculada');
  if (fieldKey === 'consultor') out.add('responsavelProcesso');
  if (fieldKey === 'responsavelProcesso') out.add('consultor');
  if (fieldKey === 'dataAudiencia') out.add('audienciaDataProcesso');
  if (fieldKey === 'audienciaDataProcesso') out.add('dataAudiencia');
  if (fieldKey === 'horaAudiencia') out.add('audienciaHoraProcesso');
  if (fieldKey === 'audienciaHoraProcesso') out.add('horaAudiencia');
  if (fieldKey === 'tipoAudiencia') out.add('tipoAudienciaProcesso');
  if (fieldKey === 'tipoAudienciaProcesso') out.add('tipoAudiencia');
  if (fieldKey === 'naturezaAcaoProcesso') out.add('descricaoAcao');
  if (fieldKey === 'descricaoAcao') out.add('naturezaAcaoProcesso');
  if (fieldKey === 'estadoProcesso') out.add('estadoProcesso');
  if (fieldKey === 'cidadeProcesso') out.add('cidadeProcesso');
  if (fieldKey === 'statusAtivoTexto') {
    out.add('processoCadastroAtivo');
  }
  return [...out];
}
