const CEP_REGEX = /\b(\d{2})\.?(\d{3})-?(\d{3})\b/;

const LOGRADOURO_RE =
  /\b(Rua|R\.|Avenida|Av\.|Travessa|Tv\.|Alameda|Rodovia|Estrada|Praça|Pr\.|Quadra|Qd\.|Lote|Lt\.)\b/gi;

const ORGAOS_EMISSORES = /^(DGPC|SSP|PC|DETRAN)$/i;

const COMPLEMENTO_KW =
  /\b(edif[ií]cio|ed\.|sala|andar|bloco|apto\.?|apartamento|conjunto|loja|cobertura|quadra|qd\.|lote|lt\.)\b/i;

const ADDRESS_TRIGGER_RE =
  /\b(?:com\s+sede\s+(?:na|em)|com\s+sede|(?:residente\s+e\s+domiciliad[oa]|domiciliad[oa]|residente)\s+(?:na|em))\s+/i;

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
  const re = /([A-ZÀ-Ú][A-Za-zÀ-ú'\s]{2,60}?)\s*(?:\/|-)\s*([A-Z]{2})\b/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const cidade = limparTrecho(m[1]);
    if (ORGAOS_EMISSORES.test(cidade.replace(/\s+/g, ''))) continue;
    if (/^[A-Z]{2,8}$/.test(cidade) && cidade.length <= 6) continue;
    return { cidade, estado: m[2] };
  }
  return null;
}

function extrairTrechoEndereco(texto) {
  const t = String(texto || '');
  const idxTrigger = t.search(ADDRESS_TRIGGER_RE);
  if (idxTrigger >= 0) {
    const after = t.slice(idxTrigger).replace(ADDRESS_TRIGGER_RE, '');
    const m = after.match(/^(.+?)(?=,\s*CEP\b|\bCEP\s*:|;\s|$)/i);
    if (m) return limparTrecho(m[1]);
  }
  return null;
}

function parseSegmentoEndereco(segmento) {
  if (!segmento) return { rua: null, numero: null, complemento: null, bairro: null };

  let parts = segmento
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const last = parts[parts.length - 1];
  if (last) {
    const mCity = last.match(/^(.+?)\s*(?:\/|-)\s*([A-Z]{2})$/);
    if (mCity && !ORGAOS_EMISSORES.test(mCity[1].replace(/\s+/g, ''))) {
      parts.pop();
    }
  }

  let bairro = null;
  const bairroIdx = parts.findIndex((p) => /^bairro\s/i.test(p));
  if (bairroIdx >= 0) {
    bairro = limparTrecho(parts[bairroIdx].replace(/^bairro\s/i, ''));
    parts.splice(bairroIdx, 1);
  }

  const centroIdx = parts.findIndex((p) => /^centro$/i.test(p));
  if (centroIdx >= 0) {
    bairro = 'Centro';
    parts.splice(centroIdx, 1);
  }

  if (!bairro) {
    const mDist = segmento.match(/\b(Distrito)\s+([^,;\n]{2,80})/i);
    if (mDist) bairro = limparTrecho(`${mDist[1]} ${mDist[2]}`);
  }

  if (!bairro) {
    const mSetor = segmento.match(/\b(Setor|Jardim|Vila|Parque)\s+([^,;\n]{2,80})/i);
    if (mSetor) bairro = limparTrecho(`${mSetor[1]} ${mSetor[2]}`);
  }

  let numero = null;
  for (let i = 0; i < parts.length; i += 1) {
    const nm = parts[i].match(/\b(?:n[º°o]\.?|n\.?\s*)\s*(\d+)\b/i);
    if (nm) {
      numero = nm[1];
      const soNumero = /^\s*(?:n[º°o]\.?|n\.?\s*)\s*\d+\s*$/i.test(parts[i]);
      if (soNumero) {
        parts.splice(i, 1);
      } else {
        parts[i] = parts[i].replace(/,?\s*(?:n[º°o]\.?|n\.?\s*)\s*\d+/i, '').trim();
        if (!parts[i]) parts.splice(i, 1);
      }
      break;
    }
  }

  const compParts = [];
  const logradouroParts = [];
  for (const p of parts) {
    if (COMPLEMENTO_KW.test(p)) compParts.push(p);
    else logradouroParts.push(p);
  }

  let rua = logradouroParts[0] ? limparTrecho(logradouroParts[0]) : null;
  if (!rua && logradouroParts.length > 0) {
    rua = limparTrecho(logradouroParts.join(', '));
  }

  const complemento = compParts.length ? compParts.map(limparTrecho).join(', ') : null;

  return { rua, numero, complemento, bairro };
}

function extrairLogradouroLegado(texto) {
  const t = String(texto || '');
  const lower = t.toLowerCase();
  const idxBairro = lower.search(/\bbairro\b/);
  const idxCep = lower.search(/\bcep\b/);
  let idxCidadeUf = -1;
  const reSlashUf = /\/\s*[a-z]{2}\b/g;
  let um;
  while ((um = reSlashUf.exec(lower)) !== null) {
    idxCidadeUf = um.index;
  }
  const limit = [idxBairro, idxCep, idxCidadeUf].filter((x) => x >= 0).sort((a, b) => a - b)[0];
  const janela = limit != null ? t.slice(0, limit) : t;

  const mAvRua = janela.match(/\b(Avenida|Av\.)\s+[^,;\n]+(?:,\s*[^,;\n]+)*/i);
  if (mAvRua) {
    const v = limparTrecho(mAvRua[0]);
    if (v.length >= 8) return v.replace(/\s*,\s*/g, ', ');
  }
  const mRua = janela.match(/\b(Rua|R\.)\s+[^,;\n]+(?:,\s*[^,;\n]+)*/i);
  if (mRua) {
    const v = limparTrecho(mRua[0]);
    if (v.length >= 8) return v.replace(/\s*,\s*/g, ', ');
  }

  LOGRADOURO_RE.lastIndex = 0;
  let m;
  let last = null;
  while ((m = LOGRADOURO_RE.exec(janela))) last = m;
  if (last) {
    const bruto = janela.slice(last.index);
    const corte = bruto.split(/\n|;/)[0];
    const v = limparTrecho(corte);
    return v.length >= 8 ? v.replace(/\s*,\s*/g, ', ') : null;
  }

  const m2 = janela.match(
    /\b(?:com\s+sede\s+(?:na|em)|com\s+sede|(?:residente|domiciliado)\s+na)\s+([^;\n]+?)(?=,?\s*(?:Bairro|CEP|[A-ZÀ-Ú][A-Za-zÀ-ú\s]{2,40}\s*\/\s*[A-Z]{2})|$)/i
  );
  if (m2) return limparTrecho(m2[1]);

  return null;
}

/**
 * @param {string} texto Normalizado
 * @returns {{ endereco: {rua:string,numero:string,complemento:string,bairro:string,cidade:string,estado:string,cep:string,cepFormatado:string}|null, candidatos: any[], avisos: string[] }}
 */
export function parseEnderecoPessoa(texto) {
  const avisos = [];
  const t = String(texto || '').trim();
  if (!t) return { endereco: null, candidatos: [], avisos };

  const candidatos = [];
  const cepDigitos = extrairCep(t);
  const cepFormatado =
    cepDigitos && cepDigitos.length === 8
      ? `${cepDigitos.slice(0, 5)}-${cepDigitos.slice(5)}`
      : cepDigitos || '';
  const cidadeUf = extrairCidadeUf(t);

  const segmento = extrairTrechoEndereco(t);
  let parsed = segmento ? parseSegmentoEndereco(segmento) : { rua: null, numero: null, complemento: null, bairro: null };

  if (!parsed.rua) {
    const legado = extrairLogradouroLegado(t);
    if (legado) {
      parsed = { ...parseSegmentoEndereco(legado), rua: parseSegmentoEndereco(legado).rua || legado };
    }
  }

  const { rua, numero, complemento, bairro } = parsed;

  const score =
    (rua ? 0.35 : 0) +
    (numero ? 0.1 : 0) +
    (complemento ? 0.1 : 0) +
    (bairro ? 0.15 : 0) +
    (cidadeUf ? 0.2 : 0) +
    (cepDigitos ? 0.2 : 0);

  if (rua || bairro || cidadeUf || cepDigitos) {
    candidatos.push({
      valor: {
        rua: rua || '',
        numero: numero || '',
        complemento: complemento || '',
        bairro: bairro || '',
        cidade: cidadeUf?.cidade || '',
        estado: cidadeUf?.estado || '',
        cep: cepDigitos || '',
        cepFormatado,
      },
      score: Math.min(0.99, score),
      origem: segmento ? 'segmento_endereco' : 'heuristica_endereco',
      valido: !!rua || !!cepDigitos || !!cidadeUf,
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
