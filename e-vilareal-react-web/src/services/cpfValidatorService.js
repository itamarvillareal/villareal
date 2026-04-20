/**
 * Validação oficial de CPF (11 dígitos + DV).
 * Reexporta lógica única usada em todo o app.
 */
export function validateCPF(cpf) {
  if (!cpf) return { valido: false, normalizado: null };
  const digitos = String(cpf).replace(/\D/g, '');
  if (digitos.length !== 11) return { valido: false, normalizado: null };
  if (/^(\d)\1+$/.test(digitos)) return { valido: false, normalizado: null };
  const calcDv = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) {
      soma += Number(base[i]) * (base.length + 1 - i);
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const dv1 = calcDv(digitos.slice(0, 9));
  const dv2 = calcDv(digitos.slice(0, 9) + String(dv1));
  if (digitos.slice(9) !== String(dv1) + String(dv2)) {
    return { valido: false, normalizado: null };
  }
  const normalizado = digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return { valido: true, normalizado };
}

/**
 * Validação de CNPJ (14 dígitos + DV).
 * @param {string|null|undefined} cnpj
 * @returns {{ valido: boolean, normalizado: string|null }}
 */
export function validateCNPJ(cnpj) {
  if (!cnpj) return { valido: false, normalizado: null };
  const digitos = String(cnpj).replace(/\D/g, '');
  if (digitos.length !== 14) return { valido: false, normalizado: null };
  if (/^(\d)\1+$/.test(digitos)) return { valido: false, normalizado: null };

  const calcularDigito = (base, pesos) => {
    let soma = 0;
    for (let i = 0; i < pesos.length; i += 1) {
      soma += Number(base[i]) * pesos[i];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = calcularDigito(digitos.slice(0, 12), pesos1);
  if (String(dv1) !== digitos[12]) return { valido: false, normalizado: null };
  const dv2 = calcularDigito(digitos.slice(0, 13), pesos2);
  if (String(dv2) !== digitos[13]) return { valido: false, normalizado: null };

  const normalizado = `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
  return { valido: true, normalizado };
}

/**
 * Ao sair do campo: valida CPF (11) ou CNPJ (14), formata se válido, devolve mensagem para toast se inválido.
 * Campo vazio → sem aviso, valor limpo.
 *
 * @param {string|null|undefined} valorBruto
 * @returns {{ ok: boolean, valor: string, aviso: string|null }}
 */
export function validarFormatarCpfCnpjAoSair(valorBruto) {
  const bruto = String(valorBruto ?? '');
  const digitos = bruto.replace(/\D/g, '');

  /** Sem dígitos (vazio, traço de mock, etc.): não valida nem altera. */
  if (digitos.length === 0) {
    return { ok: true, valor: bruto.trim(), aviso: null };
  }

  if (digitos.length < 11) {
    return {
      ok: false,
      valor: bruto,
      aviso: 'CPF ou CNPJ incompleto. CPF: 11 dígitos; CNPJ: 14 dígitos.',
    };
  }

  if (digitos.length === 11) {
    const r = validateCPF(digitos);
    if (!r.valido) {
      return {
        ok: false,
        valor: bruto,
        aviso: 'CPF inválido (dígitos verificadores incorretos).',
      };
    }
    return { ok: true, valor: r.normalizado, aviso: null };
  }

  if (digitos.length < 14) {
    return {
      ok: false,
      valor: bruto,
      aviso: 'CNPJ incompleto (são necessários 14 dígitos).',
    };
  }

  if (digitos.length === 14) {
    const r = validateCNPJ(digitos);
    if (!r.valido) {
      return {
        ok: false,
        valor: bruto,
        aviso: 'CNPJ inválido (dígitos verificadores incorretos).',
      };
    }
    return { ok: true, valor: r.normalizado, aviso: null };
  }

  return {
    ok: false,
    valor: bruto,
    aviso: 'Use 11 dígitos para CPF ou 14 para CNPJ. Remova dígitos a mais.',
  };
}
