const CPF_REGEX = /\b(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[-\s]?\d{2})\b/g;
const DATA_REGEX = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;

function normalizarCpf(cpf) {
  if (!cpf) return null;
  const digitos = String(cpf).replace(/\D/g, '');
  if (digitos.length !== 11) return null;
  if (/^(\d)\1+$/.test(digitos)) return null;
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
  if (digitos.slice(9) !== String(dv1) + String(dv2)) return null;
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function normalizarDataBr(dia, mes, ano) {
  let a = String(ano).padStart(2, '0');
  const d = String(dia).padStart(2, '0');
  const m = String(mes).padStart(2, '0');
  if (a.length === 2) {
    const n = Number(a);
    a = n >= 30 ? `19${a}` : `20${a}`;
  }
  if (a.length !== 4) return null;
  const yyyy = Number(a);
  const mm = Number(m);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2100) return null;
  return `${a}-${m}-${d}`;
}

function extrairCpf(texto) {
  if (!texto) return null;
  let match;
  let melhor = null;
  while ((match = CPF_REGEX.exec(texto))) {
    const normalizado = normalizarCpf(match[1]);
    if (normalizado) {
      melhor = normalizado;
      break;
    }
  }
  return melhor;
}

function extrairDataNascimento(texto) {
  if (!texto) return null;
  let match;
  const datas = [];
  while ((match = DATA_REGEX.exec(texto))) {
    const iso = normalizarDataBr(match[1], match[2], match[3]);
    if (iso) datas.push(iso);
  }
  if (!datas.length) return null;
  datas.sort();
  return datas[0];
}

function extrairDadosCnh(texto) {
  if (!texto) return { nome: null, cpf: null, dataNascimento: null };
  const linhasBrutas = texto.split('\n');
  const linhas = linhasBrutas.map((l) => l.replace(/\s+/g, ' ').trim());

  let nome = null;
  let dataNascimento = null;
  let cpf = null;

  const upper = linhas.map((l) => l.toUpperCase());

  // 1) Nome – tentar primeiro linhas logo após o rótulo “NOME E SOBRENOME” / “NOME/SOBRENOME”.
  const idxNome = upper.findIndex((l) =>
    /NOME\s*(E|\/)\s*SOBRENOME/.test(l) || l.includes('NOME E SOBRENOME')
  );
  if (idxNome !== -1) {
    const candidatos = [];
    if (linhas[idxNome + 1]) candidatos.push(linhas[idxNome + 1]);
    if (linhas[idxNome + 2]) candidatos.push(linhas[idxNome + 2]);
    for (const c of candidatos) {
      const limpo = c.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+/, '').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s']/g, '');
      const tokens = limpo.trim().split(/\s+/);
      if (tokens.length >= 2 && limpo.length >= 5) {
        nome = limpo.trim();
        break;
      }
    }
  }
  // Se ainda não achou, tentar a melhor linha em maiúsculas na parte superior do documento.
  if (!nome) {
    const limiteTopo = Math.min(upper.length, 25);
    let melhor = null;
    for (let i = 0; i < limiteTopo; i += 1) {
      const raw = linhas[i];
      const up = upper[i];
      if (!raw) continue;
      if (!/[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(up)) continue;
      if (PALAVRAS_IGNORAR_NOME.some((p) => up.includes(p))) continue;
      const tokens = raw.split(/\s+/);
      if (tokens.length < 2) continue;
      const limpo = raw.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s']/g, '').trim();
      if (limpo.length < 5) continue;
      if (!melhor || limpo.length > melhor.length) {
        melhor = limpo;
      }
    }
    if (melhor) nome = melhor;
  }

  // 2) Data de nascimento – usar rótulo “DATA, LOCAL E UF DE NASCIMENTO”.
  const idxNasc = upper.findIndex((l) =>
    l.includes('DATA, LOCAL E UF DE NASCIMENTO')
  );
  if (idxNasc !== -1) {
    // Na CNH digital, a data costuma estar na linha logo ABAIXO do rótulo.
    const alvo = (linhas[idxNasc + 1] || '') + ' ' + (linhas[idxNasc + 2] || '');
    let m;
    while ((m = DATA_REGEX.exec(alvo))) {
      const iso = normalizarDataBr(m[1], m[2], m[3]);
      if (iso) {
        dataNascimento = iso;
        break;
      }
    }
    if (!dataNascimento) {
      const parte = upper[idxNasc].split(/\s+/).slice(-3).join(' ');
      let m2;
      while ((m2 = DATA_REGEX.exec(parte))) {
        const iso = normalizarDataBr(m2[1], m2[2], m2[3]);
        if (iso) {
          dataNascimento = iso;
          break;
        }
      }
    }
  }

  const idxCpf = upper.findIndex((l) => l.includes('CPF'));
  if (idxCpf !== -1) {
    // Especificamente para CNH digital: o número fica logo ABAIXO do rótulo.
    const janela = [
      linhas[idxCpf + 1],
      linhas[idxCpf + 2],
      linhas[idxCpf],
      linhas[idxCpf - 1],
      linhas[idxCpf - 2],
    ]
      .filter(Boolean)
      .join(' ');
    let m;
    while ((m = CPF_REGEX.exec(janela))) {
      const normalizado = normalizarCpf(m[1]);
      if (normalizado) {
        cpf = normalizado;
        break;
      }
    }
  }

  // Se ainda não achou CPF, tentar linha MRZ-like (zona inferior da CNH digital).
  if (!cpf) {
    const ultimas = linhas.slice(-8).join(' ');
    const numerosSeguidos = ultimas.match(/\d{11}/g);
    if (numerosSeguidos && numerosSeguidos.length) {
      for (const cand of numerosSeguidos) {
        const normalizado = normalizarCpf(cand);
        if (normalizado) {
          cpf = normalizado;
          break;
        }
      }
    }
  }

  return { nome, cpf, dataNascimento };
}

const PALAVRAS_IGNORAR_NOME = [
  'REPÚBLICA',
  'FEDERATIVA',
  'BRASIL',
  'CARTEIRA',
  'IDENTIDADE',
  'REGISTRO',
  'NACIONAL',
  'HABILITAÇÃO',
  'DOCUMENTO',
  'CPF',
  'RG',
  'NÚMERO',
  'NASCIMENTO',
  'DATA',
  'EMISSÃO',
];

function ehLinhaPossivelNome(linha) {
  const s = linha.trim();
  if (s.length < 5) return false;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(s)) return false;
  const tokens = s.split(/\s+/);
  if (tokens.length < 2) return false;
  const palavrasRuins = PALAVRAS_IGNORAR_NOME.filter((p) =>
    s.toUpperCase().includes(p)
  );
  if (palavrasRuins.length) return false;
  return true;
}

function extrairNome(texto) {
  if (!texto) return null;
  const linhas = texto
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  let melhor = null;
  for (const linha of linhas) {
    if (!ehLinhaPossivelNome(linha)) continue;
    if (!melhor || linha.length > melhor.length) {
      melhor = linha;
    }
  }
  if (!melhor) return null;
  const nome = melhor.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s']/g, '').replace(/\s+/g, ' ').trim();
  return nome || null;
}

export function extrairDadosDocumentoPessoal(texto) {
  // 1ª passada: heurísticas específicas de CNH digital (títulos em português).
  let { nome, cpf, dataNascimento } = extrairDadosCnh(texto);

  // 2ª passada (se faltar algo): heurísticas genéricas só na metade superior do texto.
  if (!nome || !cpf || !dataNascimento) {
    const linhasTopo = (texto || '').split('\n').slice(0, 40).join('\n');
    if (!nome) {
      nome = extrairNome(linhasTopo) || nome;
    }
    if (!cpf) {
      cpf = extrairCpf(linhasTopo) || cpf;
    }
    if (!dataNascimento) {
      dataNascimento = extrairDataNascimento(linhasTopo) || dataNascimento;
    }
  }

  // 3ª passada (fallback final): heurísticas genéricas no texto inteiro.
  if (!nome) nome = extrairNome(texto);
  if (!cpf) cpf = extrairCpf(texto);
  if (!dataNascimento) dataNascimento = extrairDataNascimento(texto);

  if (!nome || !cpf || !dataNascimento) {
    // Ajuda na calibração: log leve no console para ajustar heurísticas com documentos reais.
    // eslint-disable-next-line no-console
    console.debug('OCR bruto (parcial) para ajuste:', (texto || '').slice(0, 800));
  }
  return {
    nomeCompleto: nome,
    cpf,
    dataNascimento,
  };
}

