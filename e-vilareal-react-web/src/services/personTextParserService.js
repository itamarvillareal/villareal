import { validateCPF } from './cpfValidatorService.js';
import { parseBrazilianDate, validateParsedDate } from './dateParserService.js';
import { scorePossiblePersonName } from './nameCandidateScoringService.js';
import { parseQualificacaoPessoa } from './personQualificationParserService.js';
import { parseEnderecoPessoa } from './personAddressParserService.js';

const CPF_REGEX = /(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s.]?\d{2}|\d{11})\b/g;
const DATA_REGEX = /\b(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{2,4})\b/g;

const ROTULOS_CPF = [
  /inscrito\s+no\s+CPF\s+sob\s+o\s+n\.?/i,
  /CPF\s*(?:n\.?|nº|n°)?\s*/i,
  /CPF\s*:\s*/i,
  /c[ée]dula\s+de\s+identidade[^.]{0,80}CPF/i,
];

const ROTULOS_NASC = [
  /nascid[oa]\s+em\s*/i,
  /data\s+de\s+nascimento\s*:?\s*/i,
  /nascimento\s*:?\s*/i,
  /nasc\.?\s*:?\s*/i,
];

const ROTULOS_RG = [
  /c[ée]dula\s+de\s+identidade\s+n\.?\s*/i,
  /identidade\s*(?:n\.?|nº|n°)?\s*/i,
  /RG\s*(?:n\.?|nº|n°)?\s*/i,
  /portador\s+da\s+c[ée]dula\s+de\s+identidade\s+n\.?\s*/i,
];

function normalizarTextoLivre(bruto) {
  const original = String(bruto || '');
  let t = original.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');
  t = t.replace(/[ \t]+/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');
  return { original, normalizado: t.trim() };
}

function indiceProximoRotulo(texto, idx, padroes) {
  let melhor = Infinity;
  for (const re of padroes) {
    const m = texto.slice(Math.max(0, idx - 120), idx + 80).search(re);
    if (m >= 0) melhor = Math.min(melhor, Math.abs(m - 40));
  }
  return melhor === Infinity ? 999 : melhor;
}

function coletarCandidatosCpf(texto) {
  const candidatos = [];
  let m;
  const upper = texto.toUpperCase();
  CPF_REGEX.lastIndex = 0;
  while ((m = CPF_REGEX.exec(texto))) {
    const raw = m[1];
    const idx = m.index;
    const val = validateCPF(raw);
    const janelaAntes = texto.slice(Math.max(0, idx - 100), idx).toLowerCase();
    let bonus = 0;
    if (/cpf|inscrito/.test(janelaAntes)) bonus += 0.35;
    if (/sob\s+o\s+n/.test(janelaAntes)) bonus += 0.2;
    const dist = indiceProximoRotulo(upper, idx, ROTULOS_CPF.map((r) => new RegExp(r.source, 'i')));
    const scoreProx = Math.max(0, 0.5 - dist / 200);
    const score = (val.valido ? 0.45 : 0.05) + bonus + scoreProx;
    candidatos.push({
      valor: val.valido ? val.normalizado : raw.replace(/\D/g, ''),
      score: Math.min(0.99, score),
      origem: val.valido ? 'cpf_validado' : 'cpf_invalido',
      valido: val.valido,
      motivos: val.valido ? [] : ['Dígitos verificadores inválidos'],
    });
  }
  return dedupMelhor(candidatos, (c) => c.valor.replace(/\D/g, ''));
}

function coletarCandidatosRg(texto) {
  const candidatos = [];
  const re1 =
    /(?:c[ée]dula\s+de\s+identidade|identidade)\s+n\.?\s*([0-9]{5,10})\s+([A-Z]{2,8}\s*\/\s*[A-Z]{2}|[A-Z]{2,8}\s+[A-Z]{2})/gi;
  let m;
  while ((m = re1.exec(texto))) {
    const valor = `${m[1]} ${m[2].replace(/\s+/g, ' ').trim()}`;
    candidatos.push({
      valor,
      score: 0.88,
      origem: 'cedula_identidade',
      valido: true,
      motivos: [],
    });
  }
  const re2 = /([0-9]{5,10})\s+(DGPC|SSP|PC|DETRAN)\s*\/?\s*([A-Z]{2})\b/gi;
  while ((m = re2.exec(texto))) {
    const valor = `${m[1]} ${m[2]}/${m[3]}`;
    if (candidatos.some((c) => c.valor.replace(/\s/g, '') === valor.replace(/\s/g, ''))) continue;
    candidatos.push({
      valor,
      score: 0.82,
      origem: 'numero_orgao_uf',
      valido: true,
      motivos: [],
    });
  }
  const re2b = /([0-9]{5,10})\s+(DGPC|SSP|PC|DETRAN)\s+([A-Z]{2})\b/gi;
  while ((m = re2b.exec(texto))) {
    const valor = `${m[1]} ${m[2]} ${m[3]}`;
    const chave = valor.replace(/\s/g, '').toUpperCase();
    if (candidatos.some((c) => c.valor.replace(/\s/g, '').toUpperCase() === chave)) continue;
    candidatos.push({
      valor,
      score: 0.8,
      origem: 'numero_orgao_espaco_uf',
      valido: true,
      motivos: [],
    });
  }
  const re3 = /RG\s*:?\s*([0-9]{5,10})\s+([^\n,;]+?)(?=,|;|\n|$)/gi;
  while ((m = re3.exec(texto))) {
    const valor = `${m[1]} ${m[2].trim()}`;
    candidatos.push({
      valor,
      score: 0.7,
      origem: 'rotulo_rg_linha',
      valido: true,
      motivos: [],
    });
  }
  const linhaRg = texto.match(/RG\s*:?\s*([^\n,;]+)/i);
  if (linhaRg) {
    const v = linhaRg[1].trim();
    if (v.length > 4 && !candidatos.some((c) => c.valor.includes(v.slice(0, 6)))) {
      candidatos.push({
        valor: v,
        score: 0.55,
        origem: 'rotulo_rg',
        valido: true,
        motivos: [],
      });
    }
  }
  return dedupMelhor(candidatos, (c) => c.valor.replace(/\s+/g, '').toUpperCase());
}

function coletarCandidatosData(texto) {
  const candidatos = [];
  const lower = texto.toLowerCase();
  DATA_REGEX.lastIndex = 0;
  let m;
  while ((m = DATA_REGEX.exec(texto))) {
    const idx = m.index;
    const iso = parseBrazilianDate(m[1], m[2], m[3]);
    const v = validateParsedDate(iso);
    const ctxAntes = lower.slice(Math.max(0, idx - 80), idx);
    let bonus = 0;
    if (/nascid|nascimento|nasc\.?/.test(ctxAntes)) bonus += 0.4;
    if (/validade|emiss[aã]o|1[ªa]\s*habilit/i.test(ctxAntes)) bonus -= 0.35;
    const score = (v.valido ? 0.5 : 0.1) + bonus + (v.valido ? 0.2 : 0);
    candidatos.push({
      valor: iso || `${m[3]}-${m[2]}-${m[1]}`,
      score: Math.min(0.98, Math.max(0, score)),
      origem: 'data_contexto',
      valido: v.valido && !!iso,
      motivos: !iso || !v.valido ? ['Data inválida ou futura'] : [],
    });
  }
  return dedupMelhor(candidatos, (c) => c.valor);
}

function coletarCandidatosNome(texto, idxCpfAprox) {
  const candidatos = [];
  const t = texto.trim();

  const r1 = t.match(/nome\s+completo\s*:\s*([^\n\r]+)/i);
  if (r1) {
    const v = limparNome(r1[1]);
    if (v) {
      candidatos.push({
        valor: v,
        score: scorePossiblePersonName(v, { posicaoInicio: 0 }),
        origem: 'rotulo_nome_completo',
        valido: true,
        motivos: [],
      });
    }
  }

  const r2 = t.match(/cliente\s*:\s*([^,\n;]+)/i);
  if (r2) {
    const v = limparNome(r2[1]);
    if (v && v.split(/\s+/).length >= 2) {
      candidatos.push({
        valor: v,
        score: scorePossiblePersonName(v, { posicaoInicio: t.indexOf(r2[0]) }),
        origem: 'rotulo_cliente',
        valido: true,
        motivos: [],
      });
    }
  }

  const r3 = t.match(
    /(?:^|\n)\s*([A-ZÀ-Ú][A-ZÀ-Ú\s']{8,}?)(?=\s*,\s*\(|,\s*brasileir[a]?\b|\s*\(\s*["']|[,;]\s*portador)/im
  );
  if (r3) {
    const v = limparNome(r3[1]);
    if (v) {
      const pos = t.indexOf(r3[1]);
      const proxCpf = idxCpfAprox != null && Math.abs(idxCpfAprox - pos) < 400;
      candidatos.push({
        valor: v,
        score: scorePossiblePersonName(v, { posicaoInicio: pos, proximoACpfOuRg: proxCpf }),
        origem: 'inicio_maiusculas_juridico',
        valido: true,
        motivos: [],
      });
    }
  }

  const primeiraLinha = t.split(/[\n;]/)[0];
  if (primeiraLinha && primeiraLinha.length > 8) {
    let semRotulo = primeiraLinha.replace(/^[^:]+:\s*/i, '').trim();
    semRotulo = semRotulo.split(',')[0];
    const v = limparNome(semRotulo);
    if (v && /^[A-Za-zÀ-ú]/.test(v) && v.split(/\s+/).length >= 2 && !/^\d/.test(v)) {
      const jaTem = candidatos.some((c) => c.valor.toUpperCase() === v.toUpperCase());
      if (!jaTem) {
        candidatos.push({
          valor: v,
          score: scorePossiblePersonName(v, { posicaoInicio: 0 }),
          origem: 'primeira_linha',
          valido: true,
          motivos: [],
        });
      }
    }
  }

  return dedupMelhor(candidatos, (c) => c.valor.toUpperCase().replace(/\s+/g, ' '));
}

function limparNome(s) {
  if (!s) return null;
  let v = s.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  v = v.replace(/^["']|["']$/g, '').trim();
  v = v.replace(/\s+/g, ' ');
  v = v.replace(/[,;]$/, '').trim();
  if (v.length < 4) return null;
  return v;
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

function primeiroCpfValidoIndex(texto) {
  let m;
  CPF_REGEX.lastIndex = 0;
  while ((m = CPF_REGEX.exec(texto))) {
    if (validateCPF(m[1]).valido) return m.index;
  }
  return null;
}

/**
 * Pipeline principal: texto livre → candidatos e melhores valores.
 * @param {string} textoBruto
 * @param {{ debug?: boolean }} opts
 */
export function parsePersonFreeText(textoBruto, opts = {}) {
  const avisos = [];
  const { original, normalizado } = normalizarTextoLivre(textoBruto);
  if (!normalizado) {
    return {
      nomeCompleto: null,
      cpf: null,
      rg: null,
      dataNascimento: null,
      nacionalidade: null,
      estadoCivil: null,
      profissao: null,
      endereco: null,
      candidatos: {
        nomeCompleto: [],
        cpf: [],
        rg: [],
        dataNascimento: [],
        nacionalidade: [],
        estadoCivil: [],
        profissao: [],
        endereco: [],
      },
      avisos: ['Texto vazio. Cole ou digite os dados e clique em Extrair.'],
      debug: opts.debug ? { original, normalizado: '' } : undefined,
    };
  }

  const idxCpf = primeiroCpfValidoIndex(normalizado);
  const cpfs = coletarCandidatosCpf(normalizado);
  const validosCpf = cpfs.filter((c) => c.valido);
  const melhorCpf = validosCpf[0] || null;
  if (cpfs.length && !validosCpf.length) {
    avisos.push('Foi encontrado número no formato CPF, mas não passou na validação; campo CPF não preenchido.');
  }
  if (cpfs.length > 1 && validosCpf.length > 1) {
    avisos.push('Vários CPFs válidos no texto; foi usado o de maior confiança contextual.');
  }

  const rgs = coletarCandidatosRg(normalizado);
  const melhorRg = rgs[0] || null;
  if (rgs.length > 1) avisos.push('Vários RGs candidatos; foi escolhido o de maior score.');

  const datas = coletarCandidatosData(normalizado);
  const datasOk = datas.filter((d) => d.valido);
  const melhorData = datasOk[0] || null;
  if (datas.length && !datasOk.length) {
    avisos.push('Datas encontradas, mas nenhuma válida como nascimento; verifique manualmente.');
  }

  const nomes = coletarCandidatosNome(normalizado, idxCpf);
  const melhorNome = nomes[0] || null;

  const qualif = parseQualificacaoPessoa(normalizado);
  avisos.push(...qualif.avisos);

  const end = parseEnderecoPessoa(normalizado);
  avisos.push(...end.avisos);

  const camposNaoEncontrados = [];
  if (!melhorNome) camposNaoEncontrados.push('nome completo');
  if (!melhorCpf) camposNaoEncontrados.push('CPF');
  if (!melhorRg) camposNaoEncontrados.push('RG');
  if (!melhorData) camposNaoEncontrados.push('data de nascimento');
  if (!qualif.nacionalidade) camposNaoEncontrados.push('nacionalidade');
  if (!qualif.estadoCivil) camposNaoEncontrados.push('estado civil');
  if (!qualif.profissao) camposNaoEncontrados.push('profissão');
  if (!end.endereco) camposNaoEncontrados.push('endereço');
  if (camposNaoEncontrados.length) {
    avisos.push(`Não identificado(s): ${camposNaoEncontrados.join(', ')}.`);
  }

  const debug =
    opts.debug === true
      ? {
          original,
          normalizado,
          candidatos: {
            nomeCompleto: nomes,
            cpf: cpfs,
            rg: rgs,
            dataNascimento: datas,
            nacionalidade: qualif.candidatos.nacionalidade,
            estadoCivil: qualif.candidatos.estadoCivil,
            profissao: qualif.candidatos.profissao,
            endereco: end.candidatos,
          },
        }
      : undefined;

  return {
    nomeCompleto: melhorNome?.valor ?? null,
    cpf: melhorCpf?.valor ?? null,
    rg: melhorRg?.valor ?? null,
    dataNascimento: melhorData?.valor ?? null,
    nacionalidade: qualif.nacionalidade,
    estadoCivil: qualif.estadoCivil,
    profissao: qualif.profissao,
    endereco: end.endereco,
    candidatos: {
      nomeCompleto: nomes,
      cpf: cpfs,
      rg: rgs,
      dataNascimento: datas,
      nacionalidade: qualif.candidatos.nacionalidade,
      estadoCivil: qualif.candidatos.estadoCivil,
      profissao: qualif.candidatos.profissao,
      endereco: end.candidatos,
    },
    avisos,
    debug,
  };
}
