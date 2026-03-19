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
