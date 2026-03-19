/**
 * Extrai nacionalidade, estado civil e profissão de textos jurídicos e cadastrais.
 * Ex.: "brasileiro, casado, empresário, portador da cédula..."
 */

const MAP_ESTADO_CIVIL = [
  { test: (s) => /uni[aã]o\s+est[aá]vel/i.test(s), valor: 'uniao_estavel', label: 'união estável' },
  { test: (s) => /casad[oa]/i.test(s), valor: 'casado', label: 'casado(a)' },
  { test: (s) => /solteir[oa]/i.test(s), valor: 'solteiro', label: 'solteiro(a)' },
  { test: (s) => /divorciad[oa]/i.test(s), valor: 'divorciado', label: 'divorciado(a)' },
  { test: (s) => /vi[uú]v[oa]/i.test(s), valor: 'viuvo', label: 'viúvo(a)' },
  { test: (s) => /separad[oa]\s+judicialmente/i.test(s), valor: 'divorciado', label: 'separado' },
];

/** Palavras que não são profissão (falso positivo após vírgulas) */
const NAO_E_PROFISSAO =
  /^(portador|inscrito|residente|domiciliado|nascid[oa]|brasileir[oa]|natural|filiad[oa]|domiciliad[oa]|cidad[ãa]o|cpf|cnpj|rg|email|e-?mail|telefone|celular|endere[çc]o|cep|bairro|cidade|estado|pa[ií]s)$/i;

function normalizarNacionalidade(token) {
  const t = token.trim().toLowerCase();
  if (/^brasileir[oa]$/.test(t)) {
    return t === 'brasileira' ? 'Brasileira' : 'Brasileiro';
  }
  if (/^estrangeir[oa]$/.test(t)) {
    return t === 'estrangeira' ? 'Estrangeira' : 'Estrangeiro';
  }
  if (/^natural\s+de\s+bras[ií]l/i.test(t)) return 'Brasileiro';
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function mapearEstadoCivil(fragmento) {
  const s = fragmento.trim();
  for (const { test, valor } of MAP_ESTADO_CIVIL) {
    if (test(s)) return valor;
  }
  return null;
}

function tituloProfissao(s) {
  const t = s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .trim();
  if (t.length < 2 || t.length > 120) return null;
  if (NAO_E_PROFISSAO.test(t.split(/\s+/)[0])) return null;
  return t
    .split(/\s+/)
    .map((w) => {
      if (/^(da|de|do|dos|das|e)$/i.test(w)) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * @param {string} texto — texto já normalizado (espaços simples)
 * @returns {{ nacionalidade: string|null, estadoCivil: string|null, profissao: string|null, candidatos: object, avisos: string[] }}
 */
export function parseQualificacaoPessoa(texto) {
  const t = String(texto || '').trim();
  const candidatos = { nacionalidade: [], estadoCivil: [], profissao: [] };
  const avisos = [];

  if (!t) {
    return {
      nacionalidade: null,
      estadoCivil: null,
      profissao: null,
      candidatos,
      avisos,
    };
  }

  // --- 1) Bloco clássico: brasileiro, casado, empresário, portador|inscrito|residente...
  const reBloco =
    /brasileir[oa]\s*,\s*(casad[oa]|solteir[oa]|divorciad[oa]|vi[uú]v[oa]|uni[aã]o\s+est[aá]vel)\s*,\s*([^,;]+?)(?=\s*,\s*(?:portador|inscrito|residente|domiciliado|nacionalidade|natural|filiad[oa]|doutor|doutora)|$)/gi;
  let m;
  while ((m = reBloco.exec(t))) {
    const natToken = m[0].match(/^brasileir[oa]/i)[0];
    candidatos.nacionalidade.push({
      valor: normalizarNacionalidade(natToken),
      score: 0.96,
      origem: 'triade_juridica',
      valido: true,
    });
    const ec = mapearEstadoCivil(m[1]);
    if (ec) {
      candidatos.estadoCivil.push({
        valor: ec,
        score: 0.95,
        origem: 'triade_juridica',
        valido: true,
      });
    }
    const prof = tituloProfissao(m[2]);
    if (prof) {
      candidatos.profissao.push({
        valor: prof,
        score: 0.94,
        origem: 'triade_juridica',
        valido: true,
      });
    }
  }

  // --- 2) Variação: brasileiro, empresário, casado (profissão antes do estado civil)
  const reInv =
    /brasileir[oa]\s*,\s*([^,;]+?)\s*,\s*(casad[oa]|solteir[oa]|divorciad[oa]|vi[uú]v[oa]|uni[aã]o\s+est[aá]vel)(?=\s*,\s*(?:portador|inscrito|residente|domiciliado)|$)/gi;
  while ((m = reInv.exec(t))) {
    const natToken = m[0].match(/^brasileir[oa]/i)[0];
    candidatos.nacionalidade.push({
      valor: normalizarNacionalidade(natToken),
      score: 0.88,
      origem: 'triade_invertida',
      valido: true,
    });
    const prof = tituloProfissao(m[1]);
    if (prof && !/^(casad|solteir|divorci|vi[uú]v|uni[aã]o)/i.test(prof)) {
      candidatos.profissao.push({
        valor: prof,
        score: 0.85,
        origem: 'triade_invertida',
        valido: true,
      });
    }
    const ec = mapearEstadoCivil(m[2]);
    if (ec) {
      candidatos.estadoCivil.push({
        valor: ec,
        score: 0.87,
        origem: 'triade_invertida',
        valido: true,
      });
    }
  }

  // --- 3) Rótulos explícitos
  const mNat = t.match(/nacionalidade\s*:?\s*(brasileir[oa]|estrangeir[oa]|[^\n,;]{2,40})/i);
  if (mNat) {
    const v = mNat[1].trim();
    const valor = /^brasileir/i.test(v) ? normalizarNacionalidade(v) : tituloProfissao(v) || v;
    candidatos.nacionalidade.push({
      valor,
      score: 0.92,
      origem: 'rotulo_nacionalidade',
      valido: true,
    });
  }

  const mEc = t.match(
    /estado\s+civil\s*:?\s*(casad[oa]|solteir[oa]|divorciad[oa]|vi[uú]v[oa]|uni[aã]o\s+est[aá]vel|separad[oa])/i
  );
  if (mEc) {
    const ec = mapearEstadoCivil(mEc[1]);
    if (ec) {
      candidatos.estadoCivil.push({
        valor: ec,
        score: 0.93,
        origem: 'rotulo_estado_civil',
        valido: true,
      });
    }
  }

  const mProf = t.match(/profiss[aã]o\s*:?\s*([^\n,;]{2,80})/i);
  if (mProf) {
    const prof = tituloProfissao(mProf[1]);
    if (prof) {
      candidatos.profissao.push({
        valor: prof,
        score: 0.93,
        origem: 'rotulo_profissao',
        valido: true,
      });
    }
  }

  // --- 4) "de nacionalidade brasileira"
  const mDeNat = t.match(/de\s+nacionalidade\s+(brasileir[oa]|estrangeir[oa])/i);
  if (mDeNat) {
    candidatos.nacionalidade.push({
      valor: normalizarNacionalidade(mDeNat[1]),
      score: 0.9,
      origem: 'de_nacionalidade',
      valido: true,
    });
  }

  // --- 5) Só nacionalidade no início após nome: ", brasileiro,"
  const mSozinho = t.match(/[),]\s*(brasileir[oa])\s*(?=,)/i);
  if (mSozinho && !candidatos.nacionalidade.some((c) => c.score >= 0.9)) {
    candidatos.nacionalidade.push({
      valor: normalizarNacionalidade(mSozinho[1]),
      score: 0.72,
      origem: 'apos_parentese',
      valido: true,
    });
  }

  function melhor(lista, chave) {
    const map = new Map();
    for (const c of lista) {
      const k = chave(c);
      const prev = map.get(k);
      if (!prev || c.score > prev.score) map.set(k, c);
    }
    return Array.from(map.values()).sort((a, b) => b.score - a.score);
  }

  const nats = melhor(candidatos.nacionalidade, (c) => c.valor);
  const ecs = melhor(candidatos.estadoCivil, (c) => c.valor);
  const profs = melhor(candidatos.profissao, (c) => c.valor.toLowerCase());

  const nacionalidade = nats[0]?.valor ?? null;
  const estadoCivil = ecs[0]?.valor ?? null;
  const profissao = profs[0]?.valor ?? null;

  if (candidatos.profissao.length > 1 && profs.length > 1) {
    const scores = profs.map((p) => p.score);
    if (scores[0] - scores[1] < 0.08) {
      avisos.push('Há mais de uma profissão possível no texto; foi usada a de maior confiança.');
    }
  }

  return {
    nacionalidade,
    estadoCivil,
    profissao,
    candidatos: {
      nacionalidade: nats,
      estadoCivil: ecs,
      profissao: profs,
    },
    avisos,
  };
}
