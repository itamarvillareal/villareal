/**
 * Dois conceitos distintos no legado VB — não misturar nos imports.
 *
 * 1) **Pessoa do cliente** (formulário Clientes)
 *    - Ficheiro: `Gerais/1000/…/{cod8}.151.1.0.txt`
 *    - Um id de pessoa por código de cliente; não depende do nº do processo.
 *    - Import: `cliente-pessoa-151-txt.mjs` → POST `/api/clientes`
 *
 * 2) **Partes do processo** (formulário Processos, par cliente × proc)
 *    - Ficheiros: `Proc/…/{cod8}.90.{proc}.{NN}.txt` — lado **parte cliente** no formulário VBA
 *                  `Proc/…/{cod8}.95.{proc}.{NN}.txt` — lado **parte oposta**
 *    - Os rótulos VBA «Autor»/«Réu» no tipo de ficheiro NÃO são o polo jurídico quando o cliente
 *      é REQUERIDO (parte cliente no REU). O import converte 90/95 → polo API com `papel_cliente`.
 *    - Várias pessoas por processo; NN = ordem (01, 02, …).
 *    - Import: `proc-processo-partes-txt.mjs` → POST `/api/processos/{id}/partes`
 *
 * O tipo `1.1` em Proc é só **título** do 1.º autor (texto), não é o `151.1.0`.
 */

/** @type {'151.1.0'} */
export const TXT_PESSOA_CLIENTE_CADASTRO = '151.1.0';

/** Slot VBA 90 — parte cliente no formulário (não é sempre polo jurídico AUTOR). */
export const POLO_PROCESSO_PARTE_CLIENTE = 'AUTOR';

/** Slot VBA 95 — parte oposta no formulário. */
export const POLO_PROCESSO_PARTE_OPOSTA = 'REU';

/**
 * @param {string | null | undefined} papelCliente
 * @returns {'REQUERENTE' | 'REQUERIDO' | null}
 */
export function normalizarPapelClienteImport(papelCliente) {
  const t = String(papelCliente ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  if (!t) return null;
  if (t.includes('REQUERIDO') || t === 'REU') return 'REQUERIDO';
  if (t.includes('REQUERENTE') || t === 'AUTOR') return 'REQUERENTE';
  return null;
}

/**
 * Converte slot VBA (90 = parte cliente, 95 = oposta) no polo jurídico da API.
 * @param {'AUTOR' | 'REU'} ladoVba — {@link POLO_PROCESSO_PARTE_CLIENTE} ou {@link POLO_PROCESSO_PARTE_OPOSTA}
 * @param {string | null | undefined} [papelCliente]
 * @returns {'AUTOR' | 'REU'}
 */
export function poloApiDesdeSlotVba(ladoVba, papelCliente = null) {
  const slotCliente = ladoVba === POLO_PROCESSO_PARTE_CLIENTE;
  const papel = normalizarPapelClienteImport(papelCliente);
  const clienteNoPoloAutor = papel !== 'REQUERIDO';
  const poloCliente = clienteNoPoloAutor ? 'AUTOR' : 'REU';
  const poloOposta = clienteNoPoloAutor ? 'REU' : 'AUTOR';
  return slotCliente ? poloCliente : poloOposta;
}

/**
 * @param {'AUTOR' | 'REU'} ladoVba — derivado do tipo de ficheiro (90 ou 95).
 * @returns {'AUTOR' | 'REU'}
 */
export function poloApiParaLadoVba(ladoVba) {
  return poloApiDesdeSlotVba(ladoVba, 'REQUERENTE');
}

/**
 * @param {string} nomeFicheiro
 * @returns {boolean}
 */
export function isNomeArquivoPessoaCliente151(nomeFicheiro) {
  return /^\d{8}\.151\.1\.0\.txt$/i.test(String(nomeFicheiro ?? '').trim());
}
