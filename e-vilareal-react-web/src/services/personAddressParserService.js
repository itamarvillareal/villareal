const CEP_REGEX = /\b(\d{2})\.?(\d{3})-?(\d{3})\b/;

const LOGRADOURO_RE =
  /\b(Rua|R\.|Avenida|Av\.|Travessa|Tv\.|Alameda|Rodovia|Estrada|Praça|Pr\.|Quadra|Qd\.|Lote|Lt\.)\b/gi;

const ORGAOS_EMISSORES = /^(DGPC|SSP|PC|DETRAN)$/i;

function limparTrecho(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/[;]+$/g, '')
    .trim();
}

function dedupMelhor(lista, keyFn) {
  const map = new Map();
  for (const c of lista) {
    const k = keyFn(c);
    const prev = map.get(k);
    if (!prev || c.score > prev.score) map.set(k, c);
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

function extrairCep(texto) {
  const m = String(texto || '').match(CEP_REGEX);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}`;
}

function extrairCidadeUf(texto) {
  const t = String(texto || '');
  // Ex.: Anápolis/GO, Goiânia - GO, São Paulo/SP
  const re = /([A-ZÀ-Ú][A-Za-zÀ-ú'\s]{2,60}?)\s*(?:\/|-)\s*([A-Z]{2})\b/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const cidade = limparTrecho(m[1]);
    // evita confundir "DGPC/GO" (órgão emissor do RG) com cidade/UF; segue para a próxima ocorrência
    if (ORGAOS_EMISSORES.test(cidade.replace(/\s+/g, ''))) continue;
    if (/^[A-Z]{2,8}$/.test(cidade) && cidade.length <= 6) continue;
    return { cidade, estado: m[2] };
  }
  return null;
}

function extrairBairro(texto) {
  const t = String(texto || '');
  const m = t.match(/\bBairro\s+([^,;\n]{2,80})/i);
  if (m) return limparTrecho(m[1]);
  // variações comuns
  const m2 = t.match(/\b(Setor|Jardim|Vila|Parque)\s+([^,;\n]{2,80})/i);
  if (m2) return limparTrecho(`${m2[1]} ${m2[2]}`);
  return null;
}

function extrairLogradouro(texto) {
  const t = String(texto || '');
  const lower = t.toLowerCase();
  const idxBairro = lower.search(/\bbairro\b/);
  const idxCep = lower.search(/\bcep\b/);
  // Último padrão "/ UF" (ex.: Anápolis/GO), não o primeiro (ex.: DGPC/GO no RG)
  let idxCidadeUf = -1;
  const reSlashUf = /\/\s*[a-z]{2}\b/g;
  let um;
  while ((um = reSlashUf.exec(lower)) !== null) {
    idxCidadeUf = um.index;
  }
  const limit = [idxBairro, idxCep, idxCidadeUf].filter((x) => x >= 0).sort((a, b) => a - b)[0];

  // Pega o trecho anterior ao bairro/cep/cidadeUF para formar a rua “completa”
  const janela = limit != null ? t.slice(0, limit) : t;

  // Preferir trecho a partir de Avenida/Rua (evita pegar só “Lote …” quando há logradouro completo antes)
  const mAvRua = janela.match(
    /\b(Avenida|Av\.)\s+[^,;\n]+(?:,\s*[^,;\n]+)*/i,
  );
  if (mAvRua) {
    const v = limparTrecho(mAvRua[0]);
    if (v.length >= 8) return v.replace(/\s*,\s*/g, ', ');
  }
  const mRua = janela.match(/\b(Rua|R\.)\s+[^,;\n]+(?:,\s*[^,;\n]+)*/i);
  if (mRua) {
    const v = limparTrecho(mRua[0]);
    if (v.length >= 8) return v.replace(/\s*,\s*/g, ', ');
  }

  // Tenta capturar a partir do ÚLTIMO token de logradouro conhecido (mais perto do CEP/bairro).
  LOGRADOURO_RE.lastIndex = 0;
  let m;
  let last = null;
  while ((m = LOGRADOURO_RE.exec(janela))) last = m;
  if (last) {
    const start = last.index;
    const bruto = janela.slice(start);
    const corte = bruto.split(/\n|;/)[0];
    const v = limparTrecho(corte);
    return v.length >= 8 ? v.replace(/\s*,\s*/g, ', ') : null;
  }

  // fallback: se houver “residente e domiciliado na ...”
  const m2 = janela.match(/\b(?:residente|domiciliado)\s+na\s+([^;\n]+?)(?=,?\s*(?:Bairro|CEP|[A-ZÀ-Ú][A-Za-zÀ-ú\s]{2,40}\s*\/\s*[A-Z]{2})|$)/i);
  if (m2) return limparTrecho(m2[1]);

  return null;
}

/**
 * @param {string} texto Normalizado
 * @returns {{ endereco: {rua:string,bairro:string,cidade:string,estado:string,cep:string}|null, candidatos: any[], avisos: string[] }}
 */
export function parseEnderecoPessoa(texto) {
  const avisos = [];
  const t = String(texto || '').trim();
  if (!t) return { endereco: null, candidatos: [], avisos };

  const candidatos = [];
  const cep = extrairCep(t);
  const cidadeUf = extrairCidadeUf(t);
  const bairro = extrairBairro(t);
  const rua = extrairLogradouro(t);

  const score =
    (rua ? 0.45 : 0) +
    (bairro ? 0.15 : 0) +
    (cidadeUf ? 0.2 : 0) +
    (cep ? 0.2 : 0);

  if (rua || bairro || cidadeUf || cep) {
    candidatos.push({
      valor: {
        rua: rua || '',
        bairro: bairro || '',
        cidade: cidadeUf?.cidade || '',
        estado: cidadeUf?.estado || '',
        cep: cep || '',
      },
      score: Math.min(0.99, score),
      origem: 'heuristica_endereco',
      valido: !!rua || !!cep || !!cidadeUf,
      motivos: [],
    });
  }

  const melhores = dedupMelhor(candidatos, (c) => JSON.stringify(c.valor));
  const melhor = melhores[0] || null;
  if (!melhor) return { endereco: null, candidatos: [], avisos };

  const v = melhor.valor;
  const okMinimo = (v.rua && v.rua.length > 6) || (v.cep && v.cep.length === 8);
  if (!okMinimo) {
    avisos.push('Endereço encontrado com baixa confiança; revise manualmente.');
    return { endereco: null, candidatos: melhores, avisos };
  }

  return {
    endereco: v,
    candidatos: melhores,
    avisos,
  };
}

