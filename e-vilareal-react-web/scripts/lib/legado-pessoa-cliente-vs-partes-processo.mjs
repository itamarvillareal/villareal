/**
 * Dois conceitos distintos no legado VB — não misturar nos imports.
 *
 * 1) **Pessoa do cliente** (formulário Clientes)
 *    - Ficheiro: `Gerais/1000/…/{cod8}.151.1.0.txt`
 *    - Um id de pessoa por código de cliente; não depende do nº do processo.
 *    - Import: `cliente-pessoa-151-txt.mjs` → POST `/api/clientes`
 *
 * 2) **Partes do processo** (formulário Processos, par cliente × proc)
 *    - Ficheiros: `Proc/…/{cod8}.90.{proc}.{NN}.txt` (VBA: Pessoa N Autor → parte cliente na UI)
 *                  `Proc/…/{cod8}.95.{proc}.{NN}.txt` (VBA: Pessoa N Réu → parte oposta)
 *    - Várias pessoas por processo; NN = ordem (01, 02, …).
 *    - Import: `proc-processo-partes-txt.mjs` → POST `/api/processos/{id}/partes`
 *
 * O tipo `1.1` em Proc é só **título** do 1.º autor (texto), não é o `151.1.0`.
 */

/** @type {'151.1.0'} */
export const TXT_PESSOA_CLIENTE_CADASTRO = '151.1.0';

/** Polo VBA / API para o lado «autor» do processo (= parte cliente na UI). */
export const POLO_PROCESSO_PARTE_CLIENTE = 'AUTOR';

/** Polo VBA / API para o lado «réu» do processo (= parte oposta na UI). */
export const POLO_PROCESSO_PARTE_OPOSTA = 'REU';

/**
 * @param {'AUTOR' | 'REU'} ladoVba — derivado do tipo de ficheiro (90 ou 95).
 * @returns {'AUTOR' | 'REU'}
 */
export function poloApiParaLadoVba(ladoVba) {
  return ladoVba === POLO_PROCESSO_PARTE_OPOSTA
    ? POLO_PROCESSO_PARTE_OPOSTA
    : POLO_PROCESSO_PARTE_CLIENTE;
}

/**
 * @param {string} nomeFicheiro
 * @returns {boolean}
 */
export function isNomeArquivoPessoaCliente151(nomeFicheiro) {
  return /^\d{8}\.151\.1\.0\.txt$/i.test(String(nomeFicheiro ?? '').trim());
}
