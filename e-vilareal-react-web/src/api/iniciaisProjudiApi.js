import { postFormData, request, requestBlob } from './httpClient.js';

/**
 * @typedef {'RESOLVIDO' | 'PENDENTE'} NivelResolucao
 */

/**
 * @typedef {Object} CampoResolvido
 * @property {string|null} valorOriginal
 * @property {number|null} idProjudi
 * @property {string|null} labelProjudi
 * @property {NivelResolucao} nivel
 * @property {string|null} motivo
 */

/**
 * @typedef {Object} ParteProjudiResolvida
 * @property {string} nome
 * @property {string} documento
 * @property {string} tipoDoc
 * @property {string|null} telefone
 * @property {string|null} email
 * @property {string|null} logradouro
 * @property {string|null} numero
 * @property {string|null} complemento
 * @property {string|null} cep
 * @property {CampoResolvido} estado
 * @property {CampoResolvido} cidade
 * @property {CampoResolvido} bairro
 * @property {boolean} prontaParaInserir
 * @property {string[]} pendencias
 */

/**
 * @typedef {Object} PendenciaParte
 * @property {string} papel
 * @property {number} pessoaId
 * @property {string[]} pendencias
 */

/**
 * @typedef {Object} PassoLog
 * @property {number} ordem
 * @property {string} passo
 * @property {number|null} httpStatus
 * @property {boolean} ok
 * @property {string} detalhe
 */

/**
 * @typedef {Object} ValidacaoProntidaoInicial
 * @property {boolean} pronta
 * @property {string[]} bloqueios
 * @property {PendenciaParte[]} pendenciasPartes
 * @property {ParteProjudiResolvida|null} [autor]
 * @property {ParteProjudiResolvida[]} [reus]
 */

/**
 * @typedef {Object} ResultadoPreparacaoInicial
 * @property {boolean} ok
 * @property {string} passoAlcancado
 * @property {string|null} hashFluxo
 * @property {PendenciaParte[]} pendenciasPartes
 * @property {string|null} respostaBruta
 * @property {PassoLog[]} passos
 */

export {
  cadastrarAssuntoProjudi,
  listarAssuntosProjudi,
  removerAssuntoProjudi,
} from './projudiAssuntosApi.js';

/**
 * @typedef {Object} AssuntoSugeridoResponse
 * @property {number|null} idAssuntoSugerido
 * @property {number|null} [idProcessoTipo]
 * @property {number|null} [processoTipoCodigo]
 * @property {string|null} [modalidadeId]
 * @property {string|null} [modalidadeRotulo]
 * @property {string|null} [classeId]
 * @property {string|null} [classeRotulo]
 */

/**
 * @typedef {Object} ClasseProjudiItem
 * @property {string} id
 * @property {string} rotulo
 * @property {number} idProcessoTipo
 * @property {number} processoTipoCodigo
 * @property {string} processoTipoLabel
 */

/**
 * @typedef {Object} ResultadoDistribuicaoInicial
 * @property {boolean} ok
 * @property {string} passoAlcancado
 * @property {string|null} numeroProcessoGerado
 * @property {boolean} [numeroGravadoCadastro]
 * @property {string|null} respostaBruta
 * @property {PassoLog[]} passos
 */

/**
 * @param {number} pessoaId
 * @param {number} [credencialId=1]
 * @returns {Promise<ParteProjudiResolvida>}
 */
export async function resolverParte(pessoaId, credencialId = 1) {
  return request('/api/projudi/iniciais/resolver-parte', {
    query: { pessoaId, credencialId },
  });
}

/** @returns {Promise<ClasseProjudiItem[]>} */
export async function listarClassesProjudi() {
  return request('/api/projudi/iniciais/classes');
}

/**
 * @param {string} [naturezaAcao]
 * @returns {Promise<AssuntoSugeridoResponse>}
 */
export async function sugerirAssuntoProjudi(naturezaAcao) {
  return request('/api/projudi/iniciais/assunto-sugerido', {
    query: { naturezaAcao: naturezaAcao ?? '' },
  });
}

/**
 * @param {string} [naturezaAcao]
 * @returns {Promise<AssuntoSugeridoResponse>}
 */
export async function sugerirModalidadeProjudi(naturezaAcao) {
  return request('/api/projudi/iniciais/modalidade-sugerida', {
    query: { naturezaAcao: naturezaAcao ?? '' },
  });
}

/**
 * @param {object} params
 * @param {number|string} params.credencialId
 * @param {string} [params.valorCausa]
 * @param {string} [params.idAssuntos]
 * @param {number|null|undefined} [params.pessoaIdAutor]
 * @param {number[]|string} [params.pessoaIdsReu]
 * @param {number|null|undefined} [params.pessoaIdReu] legado — usa só o 1º réu
 * @param {number} [params.quantidadeAnexos]
 * @returns {Promise<ValidacaoProntidaoInicial>}
 */
export async function validarProntidaoInicial({
  credencialId,
  valorCausa = '',
  idAssuntos = '',
  pessoaIdAutor,
  pessoaIdsReu,
  pessoaIdReu,
  quantidadeAnexos = 0,
}) {
  const idsReu = normalizarPessoaIdsReu(pessoaIdsReu, pessoaIdReu);
  return request('/api/projudi/iniciais/validar-prontidao', {
    query: {
      credencialId,
      valorCausa,
      idAssuntos,
      pessoaIdAutor: pessoaIdAutor ?? '',
      pessoaIdsReu: idsReu.join(','),
      quantidadeAnexos,
    },
  });
}

/** @param {number[]|string|undefined} pessoaIdsReu @param {number|null|undefined} pessoaIdReu */
function normalizarPessoaIdsReu(pessoaIdsReu, pessoaIdReu) {
  if (Array.isArray(pessoaIdsReu)) {
    return [...new Set(pessoaIdsReu.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  }
  if (typeof pessoaIdsReu === 'string' && pessoaIdsReu.trim()) {
    return [
      ...new Set(
        pessoaIdsReu
          .split(/[,;\s]+/)
          .map((parte) => Number(parte.trim()))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
  }
  const legado = Number(pessoaIdReu);
  return Number.isFinite(legado) && legado > 0 ? [legado] : [];
}

/** @param {FormData} formData */
export async function prepararInicial(formData) {
  return postFormData('/api/projudi/iniciais/preparar', formData);
}

/** @param {FormData} formData */
export async function distribuirInicial(formData) {
  return postFormData('/api/projudi/iniciais/distribuir', formData);
}

/**
 * @typedef {Object} AssinarAutomaticoInicialResponse
 * @property {number} loteId
 * @property {number[]} peticaoIds
 * @property {number} totalArquivos
 * @property {boolean} [loteReutilizado]
 */

/**
 * @typedef {Object} InicialArquivoAssinado
 * @property {number} arquivoId
 * @property {number} peticaoId
 * @property {number} ordem
 * @property {number} idArquivoTipo
 * @property {string} nomeOriginal
 * @property {string} nomeP7s
 */

/** @param {{ credencialId: number|string, codigoCliente: string, numeroInterno: number|string }} params */
export async function assinarAutomaticoInicial({ credencialId, codigoCliente, numeroInterno }) {
  return request('/api/projudi/iniciais/assinar-automatico', {
    method: 'POST',
    query: { credencialId, codigoCliente, numeroInterno },
  });
}

/** @param {number|string} loteId */
export async function consultarLoteAssinaturaInicial(loteId) {
  return request(`/api/projudi/iniciais/lote-assinatura/${loteId}`);
}

/** @param {number|string} loteId */
export async function reliberarLoteAssinaturaInicial(loteId) {
  return request(`/api/projudi/iniciais/lote-assinatura/${loteId}/reliberar`, { method: 'POST' });
}

/** @param {number|string} loteId */
export async function cancelarLoteAssinaturaInicial(loteId) {
  return request(`/api/projudi/iniciais/lote-assinatura/${loteId}/cancelar`, { method: 'POST' });
}

/** @param {{ codigoCliente: string, numeroInterno: number|string }} params @returns {Promise<InicialArquivoAssinado[]>} */
export async function listarArquivosAssinadosInicial({ codigoCliente, numeroInterno }) {
  return request('/api/projudi/iniciais/arquivos-assinados', {
    query: { codigoCliente, numeroInterno },
  });
}

/** @param {{ arquivoId: number, codigoCliente: string, numeroInterno: number|string, nomeFallback?: string }} params */
export async function baixarP7sAssinadoInicial({ arquivoId, codigoCliente, numeroInterno, nomeFallback }) {
  const { blob, filename } = await requestBlob(
    `/api/projudi/iniciais/arquivos-assinados/${arquivoId}/p7s`,
    {
      query: { codigoCliente, numeroInterno },
      accept: 'application/octet-stream',
      fallbackFilename: nomeFallback || 'documento.p7s',
    },
  );
  return blob;
}
