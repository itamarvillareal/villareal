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

export function validateBirthDate(isoDate) {
  if (!isoDate) return { valido: false };
  const [y, m, d] = String(isoDate).split('-').map((x) => Number(x));
  if (!y || !m || !d) return { valido: false };
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return { valido: false };
  const data = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(data.getTime())) return { valido: false };
  if (data.getUTCFullYear() !== y || data.getUTCMonth() + 1 !== m || data.getUTCDate() !== d) {
    return { valido: false };
  }
  return { valido: true };
}

export function scoreName(nome) {
  if (!nome) return 0;
  const s = String(nome).trim();
  const palavras = s.split(/\s+/);
  if (palavras.length < 2) return 0.2;
  if (palavras.length === 2) return 0.7;
  return Math.min(0.95, 0.7 + palavras.length * 0.05);
}

export function scoreRG(rg) {
  if (!rg) return 0;
  const s = String(rg).toUpperCase();
  let score = 0.4;
  if (/\d{5,}/.test(s)) score += 0.2;
  if (/(SSP|DGPC|PC|DETRAN)/.test(s)) score += 0.2;
  if (/[A-Z]{2}$/.test(s.replace(/\s+/g, ''))) score += 0.1;
  return Math.min(0.9, score);
}

