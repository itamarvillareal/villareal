import { postFormData, request } from './httpClient.js';

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
 * @property {ParteProjudiResolvida|null} [reu]
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

/**
 * @typedef {Object} AssuntoProjudiItem
 * @property {number} idAssunto
 * @property {string} rotuloCompleto
 */

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

/** @returns {Promise<AssuntoProjudiItem[]>} */
export async function listarAssuntosProjudi() {
  return request('/api/projudi/iniciais/assuntos');
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
 * @param {number|null|undefined} [params.pessoaIdReu]
 * @param {number} [params.quantidadeAnexos]
 * @returns {Promise<ValidacaoProntidaoInicial>}
 */
export async function validarProntidaoInicial({
  credencialId,
  valorCausa = '',
  idAssuntos = '',
  pessoaIdAutor,
  pessoaIdReu,
  quantidadeAnexos = 0,
}) {
  return request('/api/projudi/iniciais/validar-prontidao', {
    query: {
      credencialId,
      valorCausa,
      idAssuntos,
      pessoaIdAutor: pessoaIdAutor ?? '',
      pessoaIdReu: pessoaIdReu ?? '',
      quantidadeAnexos,
    },
  });
}

/** @param {FormData} formData */
export async function prepararInicial(formData) {
  return postFormData('/api/projudi/iniciais/preparar', formData);
}

/** @param {FormData} formData */
export async function distribuirInicial(formData) {
  return postFormData('/api/projudi/iniciais/distribuir', formData);
}
