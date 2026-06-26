/**
 * Validação de conta bancária a partir do cabeçalho OFX (BANKACCTFROM).
 * Exige cadastro prévio em conta_bancaria (ofx_bank_id, ofx_agencia, ofx_conta).
 */

export function normalizarOfxIdentificador(val) {
  return String(val ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function normalizarOfxBankId(val) {
  const digits = normalizarOfxIdentificador(val).replace(/\D/g, '');
  if (!digits) return normalizarOfxIdentificador(val);
  return digits.replace(/^0+/, '') || digits;
}

/** @param {{ ofxBankId?: string|null, ofxAgencia?: string|null, ofxConta?: string|null }|null|undefined} banco */
export function contaTemCadastroOfx(banco) {
  return Boolean(
    normalizarOfxIdentificador(banco?.ofxBankId) && normalizarOfxIdentificador(banco?.ofxConta),
  );
}

function ofxContaCoincideComCadastro(ofxConta, banco) {
  if (!ofxConta || !contaTemCadastroOfx(banco)) return false;
  const bankOk = normalizarOfxBankId(ofxConta.bankId) === normalizarOfxBankId(banco.ofxBankId);
  const agOk =
    !normalizarOfxIdentificador(banco.ofxAgencia) ||
    normalizarOfxIdentificador(ofxConta.agencia) === normalizarOfxIdentificador(banco.ofxAgencia);
  const contaOk =
    normalizarOfxIdentificador(ofxConta.conta) === normalizarOfxIdentificador(banco.ofxConta);
  return bankOk && agOk && contaOk;
}

/** @param {{ bankId?: string, agencia?: string, conta?: string }} ofxConta @param {object[]} bancos */
export function identificarContaPorOfx(ofxConta, bancos) {
  if (!ofxConta?.bankId || !ofxConta?.conta) return null;
  for (const b of bancos ?? []) {
    if (ofxContaCoincideComCadastro(ofxConta, b)) return b;
  }
  return null;
}

/** @param {{ ofxBankId?: string, ofxAgencia?: string, ofxConta?: string, bankId?: string, agencia?: string, conta?: string }|null} ref */
export function formatarRotuloContaOfx(ref) {
  if (!ref) return '';
  const bankId = ref.ofxBankId ?? ref.bankId ?? '';
  const agencia = ref.ofxAgencia ?? ref.agencia ?? '';
  const conta = ref.ofxConta ?? ref.conta ?? '';
  return [bankId, agencia, conta].filter(Boolean).join(' / ');
}

/**
 * @param {{ bankId?: string, agencia?: string, conta?: string }|null} ofxConta
 * @param {object|null} bancoDestino
 * @param {object[]} bancos
 */
export function validarOfxParaContaDestino(ofxConta, bancoDestino, bancos) {
  if (!ofxConta?.bankId && !ofxConta?.conta) {
    return { ok: true, ofxConta, ignorado: true };
  }

  const destinoTemCadastro = contaTemCadastroOfx(bancoDestino);
  const contaIdentificada = identificarContaPorOfx(ofxConta, bancos);

  if (destinoTemCadastro) {
    if (ofxContaCoincideComCadastro(ofxConta, bancoDestino)) {
      return { ok: true, ofxConta };
    }
    if (contaIdentificada) {
      return {
        ok: false,
        message:
          `Este OFX é da conta ${formatarRotuloContaOfx(contaIdentificada)} (${contaIdentificada.nome}), ` +
          `não de ${bancoDestino?.nome ?? 'destino selecionado'}.`,
        contaSugerida: { nome: contaIdentificada.nome, numero: contaIdentificada.numero },
        ofxConta,
        contaEsperada: bancoDestino,
      };
    }
    return {
      ok: false,
      message:
        `O OFX não corresponde à conta cadastrada de ${bancoDestino?.nome ?? 'destino'} ` +
        `(esperado: ${formatarRotuloContaOfx(bancoDestino)}; arquivo: ${formatarRotuloContaOfx(ofxConta)}).`,
      ofxConta,
      contaEsperada: bancoDestino,
    };
  }

  if (contaIdentificada && contaIdentificada.nome !== bancoDestino?.nome) {
    return {
      ok: false,
      message:
        `Este OFX pertence à conta ${contaIdentificada.nome} (${formatarRotuloContaOfx(contaIdentificada)}), ` +
        `não a ${bancoDestino?.nome ?? 'destino selecionado'}.`,
      contaSugerida: { nome: contaIdentificada.nome, numero: contaIdentificada.numero },
      ofxConta,
    };
  }

  return { ok: true, ofxConta };
}
