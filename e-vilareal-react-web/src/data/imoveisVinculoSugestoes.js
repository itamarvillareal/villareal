/**
 * Sugestões de vínculo Cod.+Proc. para lançamentos bancários (administração de imóveis).
 * Usa cadastro dos imóveis + histórico de lançamentos já vinculados.
 */

import { mesReferenciaDataBr, TAG_ADM_ALUGUEL, TAG_ADM_REPASSE } from './imoveisAdministracaoFinanceiro.js';
import { parseValorMonetarioBr } from '../utils/parseValorMonetarioBr.js';

export const TIPO_SUGESTAO_ALUGUEL = 'aluguel';
export const TIPO_SUGESTAO_REPASSE = 'repasse';
export const TIPO_SUGESTAO_OUTRO = 'outro';

function normalizarTexto(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Primeiros nomes muito comuns — sozinhos não vinculam (evita «Maria» → qualquer Maria). */
const PRIMEIROS_NOME_COMUNS = new Set([
  'ana',
  'bia',
  'eva',
  'leo',
  'lia',
  'luis',
  'luiz',
  'maria',
  'joao',
  'jose',
  'paulo',
  'pedro',
  'rosa',
  'carlos',
  'marcos',
  'julia',
  'lucas',
  'luisa',
  'antonio',
  'francisco',
  'fernanda',
  'patricia',
  'sandra',
  'claudia',
  'ricardo',
  'roberto',
  'bruno',
  'carla',
  'daniel',
  'eduardo',
  'fabio',
  'gabriel',
  'helena',
  'juliana',
  'larissa',
  'nelson',
  'priscila',
  'renato',
  'sergio',
  'tatiana',
]);

function tokensNome(nome) {
  const t = normalizarTexto(nome)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((x) => x.length >= 3);
  return [...new Set(t)];
}

/** Tokens que identificam o locatário (sobrenomes / nomes menos genéricos). */
export function tokensNomeParaMatch(nome) {
  const todos = tokensNome(nome);
  const fortes = todos.filter((t) => t.length >= 5 && !PRIMEIROS_NOME_COMUNS.has(t));
  const distintivos = todos.filter((t) => !PRIMEIROS_NOME_COMUNS.has(t) && t.length >= 4);
  return {
    todos,
    fortes,
    distintivos: fortes.length > 0 ? fortes : distintivos.length > 0 ? distintivos : todos,
  };
}

export function textoLancamentoParaMatch(lanc) {
  return normalizarTexto(`${lanc.descricao ?? ''} ${lanc.descricaoDetalhada ?? ''}`);
}

/** Há nome de pessoa identificável na descrição do PIX (não só valor genérico). */
export function pagadorAparenteNoLancamento(textoNorm) {
  const limpo = textoNorm
    .replace(/pagamento recebido/g, ' ')
    .replace(/pix transf/g, ' ')
    .replace(/\d{3}[\d.\-/]{6,}\d{2}/g, ' ');
  const tokens = tokensNome(limpo);
  const fortes = tokens.filter((t) => t.length >= 5 && !PRIMEIROS_NOME_COMUNS.has(t));
  const distintivos = tokens.filter((t) => !PRIMEIROS_NOME_COMUNS.has(t) && t.length >= 4);
  return fortes.length >= 1 || distintivos.length >= 2 || tokens.length >= 3;
}

/**
 * Compara locatário cadastrado com o texto do lançamento.
 * @returns {{ hitsTodos: number, hitsDistintivos: number, hitsFortes: number, elegivelModoGeral: boolean, temLocatarioCadastrado: boolean, pontosNome: number }}
 */
/** Extrai o trecho com nome do pagador na descrição do extrato (ex.: após «Pagamento recebido -»). */
/** Trecho com nome do destinatário em débitos (repasse PIX TRANSF, etc.). */
export function extrairTextoDestinatarioDoLancamento(lanc) {
  const raw = String(lanc?.descricao ?? lanc ?? '').trim();
  let trecho = raw;
  const m = /\b(?:pix\s*)?transf(?:erencia)?(?:\s+enviada)?\s+(?:para\s+)?(.+)/i.exec(raw);
  if (m) trecho = m[1];
  trecho = trecho
    .replace(/\d{2}\/\d{2}(?:\/\d{4})?/g, ' ')
    .replace(/\d{3}[\d.\-/]{6,}\d{2}/g, ' ')
    .replace(/(\d+)\/(\d+)/g, ' ');
  return normalizarTexto(trecho.replace(/[^a-zA-ZÀ-ú\s]/g, ' '));
}

export function extrairTextoPagadorDoLancamento(lanc) {
  if (lancamentoApiDebitoBanco(lanc)) {
    const dest = extrairTextoDestinatarioDoLancamento(lanc);
    if (dest) return dest;
  }
  const raw = String(lanc?.descricao ?? lanc ?? '').trim();
  const parts = raw.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);
  const namePart =
    parts.find(
      (p) =>
        /[a-zA-ZÀ-ú]{2,}/.test(p) &&
        !/^\d{3,}/.test(p.replace(/\s/g, '')) &&
        !/pagamento|recebido|^pix$|transf/i.test(p),
    ) ??
    parts.find((p) => p.length > 3 && !/pagamento/i.test(p)) ??
    raw;
  return normalizarTexto(namePart);
}

function toleranciaValor(vRef) {
  return Math.max(30, Math.abs(vRef) * 0.03);
}

function valorCombinaReferencia(valorLanc, valorRef, tol) {
  if (!(valorLanc > 0) || !(valorRef > 0)) return { bate: false, diff: Infinity };
  const diff = Math.abs(valorLanc - valorRef);
  const t = tol ?? toleranciaValor(valorRef);
  return { bate: diff <= 1, proximo: diff <= t, diff };
}

function melhorMatchValorHistorico(valorLanc, valores = []) {
  let melhor = null;
  for (const v of valores) {
    const { bate, proximo, diff } = valorCombinaReferencia(valorLanc, v);
    if (!bate && !proximo) continue;
    if (!melhor || diff < melhor.diff) melhor = { valor: v, diff, exato: bate };
  }
  return melhor;
}

/**
 * Regra estrita só para cor de linha (não afeta score de sugestão).
 * Evita azul quando só sobrenomes batem (ex.: Oliveira + Silva com Larissa vs Ana).
 */
export function coincidenciaVisualNomeExtratoLocatario(pagadorNorm, locatarioNorm) {
  const pag = normalizarTexto(pagadorNorm);
  const loc = normalizarTexto(locatarioNorm);
  if (!pag || !loc) return false;
  if (pag.includes(loc) || loc.includes(pag)) return true;

  const tokPag = tokensNome(pag);
  const tokLoc = tokensNome(loc);
  if (!tokPag.length || !tokLoc.length) return false;

  const primeiroPag = tokPag[0];
  const primeiroLoc = tokLoc[0];
  const comunsNaoGenericos = tokPag.filter(
    (t) => tokLoc.includes(t) && !PRIMEIROS_NOME_COMUNS.has(t) && t.length >= 4,
  );

  if (!PRIMEIROS_NOME_COMUNS.has(primeiroPag) && !PRIMEIROS_NOME_COMUNS.has(primeiroLoc)) {
    if (primeiroPag !== primeiroLoc) return false;
    return comunsNaoGenericos.length >= 1 || tokPag.filter((t) => tokLoc.includes(t)).length >= 2;
  }

  if (!PRIMEIROS_NOME_COMUNS.has(primeiroPag) && !tokLoc.includes(primeiroPag)) return false;
  if (!PRIMEIROS_NOME_COMUNS.has(primeiroLoc) && !tokPag.includes(primeiroLoc)) return false;

  if (PRIMEIROS_NOME_COMUNS.has(primeiroPag) && PRIMEIROS_NOME_COMUNS.has(primeiroLoc) && primeiroPag !== primeiroLoc) {
    return false;
  }

  if (primeiroPag === primeiroLoc) {
    return comunsNaoGenericos.length >= 1;
  }

  return comunsNaoGenericos.length >= 2 && comunsNaoGenericos.some((t) => t.length >= 6);
}

/**
 * Destaque visual na tabela: nome no extrato vs locatário sugerido.
 * @returns {'coincide'|'diferente'|'indeterminado'}
 */
export function classificarDestaqueNomeExtratoVinculo(lancOuDescricao, locatario) {
  const loc = String(locatario ?? '').trim();
  if (!loc) return 'indeterminado';

  const lanc =
    typeof lancOuDescricao === 'string' ? { descricao: lancOuDescricao, descricaoDetalhada: '' } : lancOuDescricao;

  const textoFull = textoLancamentoParaMatch(lanc);
  if (!pagadorAparenteNoLancamento(textoFull)) return 'indeterminado';

  const textoPagador = extrairTextoPagadorDoLancamento(lanc);
  if (!textoPagador) return 'indeterminado';

  return coincidenciaVisualNomeExtratoLocatario(textoPagador, loc) ? 'coincide' : 'diferente';
}

/** Alias para testes e uso externo. */
export const classificarCoincidenciaNomeExtratoVinculo = classificarDestaqueNomeExtratoVinculo;

/** Classes Tailwind para destacar linha da tabela de sugestões. */
export function classesLinhaCoincidenciaNome(tipo, destaqueImovelAberto = false) {
  switch (tipo) {
    case 'coincide':
      return 'bg-sky-100/90 border-sky-200/80 hover:bg-sky-100';
    case 'diferente':
      return 'bg-red-50/95 border-red-100/90 hover:bg-red-100/80';
    default:
      return destaqueImovelAberto
        ? 'bg-violet-50/70 hover:bg-violet-50/90 border-violet-100'
        : 'border-violet-100 hover:bg-violet-50/40';
  }
}

export function analisarMatchNomeLocatario(imovel, textoNorm) {
  const inq = String(imovel?.inquilino ?? '').trim();
  if (!inq) {
    return {
      hitsTodos: 0,
      hitsDistintivos: 0,
      hitsFortes: 0,
      elegivelModoGeral: true,
      temLocatarioCadastrado: false,
      pontosNome: 0,
    };
  }
  const { todos, distintivos, fortes } = tokensNomeParaMatch(inq);
  const hitsTodos = contarTokensNoTexto(todos, textoNorm);
  const hitsDistintivos = contarTokensNoTexto(distintivos, textoNorm);
  const hitsFortes = contarTokensNoTexto(fortes, textoNorm);

  const elegivelModoGeral =
    hitsFortes >= 2 ||
    (hitsDistintivos >= 2 && hitsTodos >= 2) ||
    (hitsFortes >= 1 && hitsTodos >= 2) ||
    hitsTodos >= 3;

  const pontosNome = hitsFortes * 55 + hitsDistintivos * 28 + hitsTodos * 8;

  return {
    hitsTodos,
    hitsDistintivos,
    hitsFortes,
    elegivelModoGeral,
    temLocatarioCadastrado: true,
    pontosNome,
  };
}

function parseDia(d) {
  const n = Number(String(d ?? '').replace(/\D/g, ''));
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : null;
}

export function lancamentoApiSemVinculoProcesso(l) {
  const proc = l?.numeroInternoProcesso;
  if (proc != null && proc !== '' && Number(proc) !== 0) return false;
  if (l?.processoId != null && Number(l.processoId) > 0) return false;
  return true;
}

export function lancamentoApiCreditoBanco(l) {
  if (l?.cartaoId != null || String(l?.cartaoNome ?? '').trim() !== '') return false;
  const nat = String(l?.natureza ?? '').toUpperCase();
  if (nat === 'DEBITO') return false;
  if (nat === 'CREDITO') return true;
  return Number(l?.valor ?? 0) > 0;
}

export function lancamentoApiDebitoBanco(l) {
  if (l?.cartaoId != null || String(l?.cartaoNome ?? '').trim() !== '') return false;
  const nat = String(l?.natureza ?? '').toUpperCase();
  if (nat === 'CREDITO') return false;
  if (nat === 'DEBITO') return true;
  return Number(l?.valor ?? 0) < 0;
}

/** Crédito ou débito em conta bancária (candidato a vínculo no extrato). */
export function lancamentoApiExtratoBanco(l) {
  return lancamentoApiCreditoBanco(l) || lancamentoApiDebitoBanco(l);
}

export function valorAbsolutoLancamentoApi(l) {
  return Math.abs(Number(l?.valor ?? 0));
}

function distanciaDiaPagamento(diaLanc, diaRef, ultimoDiaMes) {
  if (!diaLanc || !diaRef) return null;
  const wrap = (a, b) => Math.min(Math.abs(a - b), ultimoDiaMes - Math.abs(a - b));
  return wrap(diaLanc, diaRef);
}

export function contarTokensNoTexto(tokens, textoNorm) {
  if (!tokens.length || !textoNorm) return 0;
  return tokens.filter((t) => textoNorm.includes(t)).length;
}

function dataApiParaBr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '').trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Perfil aprendido com lançamentos já vinculados ao par cod+proc.
 * @param {object[]} lancamentosHistorico — DTO API
 */
export function construirPerfilHistoricoImovel(lancamentosHistorico) {
  const vinculados = (lancamentosHistorico || []).filter((l) => !lancamentoApiSemVinculoProcesso(l));
  const creditos = vinculados.filter(lancamentoApiCreditoBanco);
  const debitos = vinculados.filter(lancamentoApiDebitoBanco);
  const valores = creditos.map(valorAbsolutoLancamentoApi).filter((v) => v > 0);
  const valoresDebito = debitos.map(valorAbsolutoLancamentoApi).filter((v) => v > 0);
  const dias = creditos
    .map((l) => mesReferenciaDataBr(dataApiParaBr(l.dataLancamento)))
    .filter(Boolean)
    .map((m) => m.dia);
  const diasDebito = debitos
    .map((l) => mesReferenciaDataBr(dataApiParaBr(l.dataLancamento)))
    .filter(Boolean)
    .map((m) => m.dia);
  const bancos = [
    ...new Set(
      [...creditos, ...debitos].map((l) => String(l.bancoNome ?? '').trim()).filter(Boolean),
    ),
  ];
  const textos = creditos.map((l) =>
    normalizarTexto(`${l.descricao ?? ''} ${l.descricaoDetalhada ?? ''}`),
  );
  const textosDebito = debitos.map((l) =>
    normalizarTexto(`${l.descricao ?? ''} ${l.descricaoDetalhada ?? ''}`),
  );

  const sortedDeb = [...valoresDebito].sort((a, b) => a - b);

  return {
    qtdCreditos: creditos.length,
    qtdDebitos: debitos.length,
    valores,
    valoresDebito,
    dias,
    diasDebito,
    bancos,
    textos,
    textosDebito,
    valorMediano: valores.length ? valores.sort((a, b) => a - b)[Math.floor(valores.length / 2)] : null,
    valorMedianoDebito: sortedDeb.length ? sortedDeb[Math.floor(sortedDeb.length / 2)] : null,
  };
}

/**
 * @param {object} lanc — DTO API candidato (sem proc)
 * @param {object} imovel — item UI cadastro
 * @param {ReturnType<typeof construirPerfilHistoricoImovel>} historico
 * @param {{ inquilinoUnico?: boolean, nome?: ReturnType<typeof analisarMatchNomeLocatario> }} ctx
 */
export function pontuarSugestaoVinculoImovel(lanc, imovel, historico, ctx = {}) {
  const motivos = [];
  let score = 0;

  const ehDebito = ctx.ehDebito === true || lancamentoApiDebitoBanco(lanc);
  const valorLanc = valorAbsolutoLancamentoApi(lanc);
  const valorRef = parseValorMonetarioBr(imovel.valorLocacao) ?? 0;
  const texto = textoLancamentoParaMatch(lanc);
  const pessoaCadastro = ehDebito ? String(imovel.proprietario ?? '').trim() : String(imovel.inquilino ?? '').trim();
  const nome =
    ctx.nome ??
    (pessoaCadastro ? analisarMatchNomeLocatario({ inquilino: pessoaCadastro }, texto) : null);
  const hits = nome?.hitsTodos ?? 0;
  const mesBr = mesReferenciaDataBr(dataApiParaBr(lanc.dataLancamento));

  const diaLanc = mesBr?.dia ?? null;
  const diaRef = parseDia(ehDebito ? imovel.diaRepasse : imovel.diaPagAluguel);
  const ultimoDia = mesBr
    ? new Date(Number(mesBr.chave.split('-')[0]), Number(mesBr.chave.split('-')[1]), 0).getDate()
    : 31;

  if (ehDebito) {
    const matchHist = melhorMatchValorHistorico(valorLanc, historico.valoresDebito ?? []);
    if (matchHist?.exato) {
      score += 52;
      motivos.push(
        `Valor igual a repasse(s) já vinculado(s) a este imóvel (${matchHist.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
      );
    } else if (matchHist) {
      score += 38;
      motivos.push(
        `Valor próximo ao histórico de repasse deste imóvel (diferença ${matchHist.diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
      );
    } else if (historico.valorMedianoDebito != null) {
      const { bate, proximo, diff } = valorCombinaReferencia(valorLanc, historico.valorMedianoDebito);
      if (bate) {
        score += 40;
        motivos.push('Valor igual ao repasse mediano já vinculado a este imóvel');
      } else if (proximo) {
        score += 26;
        motivos.push(`Valor próximo ao repasse mediano (diferença ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
      }
    }

    if (nome?.hitsFortes >= 2) {
      score += 42;
      motivos.push(`Nome do locador (${imovel.proprietario}) na descrição do PIX`);
    } else if (hits >= 2) {
      score += 32;
      motivos.push(`Nome do locador (${imovel.proprietario}) aparece na descrição`);
    } else if (hits === 1) {
      score += 10;
      motivos.push('Parte do nome do locador na descrição (confira o valor antes de aprovar)');
    } else if (nome?.temLocatarioCadastrado && pagadorAparenteNoLancamento(texto)) {
      score = Math.min(score, 22);
      motivos.push('Valor compatível, mas o destinatário do PIX não bate com o locador deste imóvel');
    }

    if (ctx.proprietarioUnico) {
      score += 18;
      motivos.push('Locador vinculado a apenas este Cod.+Proc. no cadastro');
    }

    const tokensProp = tokensNome(imovel.proprietario);
    if ((historico.textosDebito ?? []).length > 0 && tokensProp.length > 0) {
      const hitHist = historico.textosDebito.some((ht) => tokensProp.filter((t) => ht.includes(t)).length >= 2);
      if (hitHist) {
        score += 12;
        motivos.push('Padrão de nome semelhante a repasses já vinculados a este imóvel');
      }
    }
  } else if (valorRef > 0 && valorLanc > 0) {
    const { bate, proximo, diff } = valorCombinaReferencia(valorLanc, valorRef);
    if (bate) {
      score += 45;
      motivos.push(`Valor igual ao aluguel de referência (${valorRef.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
    } else if (proximo) {
      score += 32;
      motivos.push(`Valor próximo ao aluguel de referência (diferença ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
    }
  }

  if (diaRef && diaLanc) {
    const dist = distanciaDiaPagamento(diaLanc, diaRef, ultimoDia);
    if (dist != null && dist <= 3) {
      score += 28;
      motivos.push(
        ehDebito
          ? `Data próxima ao dia de repasse cadastrado (dia ${String(diaRef).padStart(2, '0')})`
          : `Data próxima ao dia de pagamento cadastrado (dia ${String(diaRef).padStart(2, '0')})`,
      );
    } else if (dist != null && dist <= 7) {
      score += 14;
      motivos.push(`Data razoavelmente próxima ao vencimento (dia ${String(diaRef).padStart(2, '0')})`);
    } else if (!ehDebito && diaRef >= 25 && diaLanc <= 5) {
      score += 10;
      motivos.push('Crédito no início do mês (compatível com vencimento no fim do mês)');
    }
  }

  if (!ehDebito) {
    if (nome?.hitsFortes >= 2) {
      score += 48;
      motivos.push(`Sobrenome/nome forte do locatário (${imovel.inquilino}) na descrição do PIX`);
    } else if (hits >= 2) {
      score += 38;
      motivos.push(`Nome do locatário (${imovel.inquilino}) aparece na descrição`);
    } else if (hits === 1) {
      score += 12;
      motivos.push(`Apenas parte do nome na descrição (confira antes de aprovar)`);
    } else if (nome?.temLocatarioCadastrado && pagadorAparenteNoLancamento(texto)) {
      score = Math.min(score, 28);
      motivos.push('Valor/data compatíveis, mas o nome do PIX não bate com o locatário deste imóvel');
    }

    if (ctx.inquilinoUnico) {
      score += 22;
      motivos.push('Locatário vinculado a apenas este Cod.+Proc. no cadastro');
    }
  }

  const banco = String(lanc.bancoNome ?? '').trim();
  if (banco && historico.bancos.includes(banco)) {
    score += 12;
    motivos.push(`Mesmo banco (${banco}) em vínculos anteriores`);
  }

  if (!ehDebito && historico.valorMediano != null && valorLanc > 0) {
    const { bate } = valorCombinaReferencia(valorLanc, historico.valorMediano);
    if (bate) {
      score += 18;
      motivos.push('Valor igual a créditos já vinculados a este imóvel');
    }
  }

  if (!ehDebito && historico.qtdCreditos >= 2) {
    score += 8;
    motivos.push(`${historico.qtdCreditos} crédito(s) já vinculado(s) a este imóvel (histórico)`);
  }
  if (ehDebito && historico.qtdDebitos >= 2) {
    score += 8;
    motivos.push(`${historico.qtdDebitos} repasse(s) já vinculado(s) a este imóvel (histórico)`);
  }

  if (!ehDebito && valorRef > 0 && valorLanc > 0) {
    const { bate } = valorCombinaReferencia(valorLanc, valorRef);
    if (bate && hits >= 1) {
      score += 12;
      motivos.push('Valor do aluguel e nome do locatário na descrição');
    }
  }

  if (!ehDebito) {
    const tokensInq = tokensNome(imovel.inquilino);
    if (historico.textos.length > 0 && tokensInq.length > 0) {
      const hitHist = historico.textos.some((ht) => tokensInq.filter((t) => ht.includes(t)).length >= 2);
      if (hitHist) {
        score += 14;
        motivos.push('Padrão de nome semelhante a créditos já vinculados a este imóvel');
      }
    }
  }

  let confianca = 'baixa';
  if (ehDebito) {
    const valorForte = melhorMatchValorHistorico(valorLanc, historico.valoresDebito ?? [])?.exato;
    if ((valorForte && hits >= 1) || (nome?.hitsFortes >= 2 && score >= 55)) confianca = 'alta';
    else if (score >= 58 && (hits >= 2 || valorForte)) confianca = 'alta';
    else if (score >= 42) confianca = 'media';
  } else {
    if (nome?.hitsFortes >= 2 || (hits >= 2 && score >= 55)) confianca = 'alta';
    else if (score >= 70 && hits >= 1) confianca = 'alta';
    else if (score >= 48) confianca = 'media';
  }

  const tipo = ehDebito
    ? TIPO_SUGESTAO_REPASSE
    : valorLanc > 0 && (hits >= 2 || nome?.hitsFortes >= 1)
      ? TIPO_SUGESTAO_ALUGUEL
      : TIPO_SUGESTAO_OUTRO;

  return {
    score,
    confianca,
    motivos,
    tipo,
    mesReferencia: mesBr?.label ?? null,
    chaveMes: mesBr?.chave ?? null,
  };
}

/**
 * @param {object[]} candidatos — lançamentos API sem proc
 * @param {object[]} imoveis — cadastro UI
 * @param {Map<string, ReturnType<typeof construirPerfilHistoricoImovel>>} historicosPorChave — `${cod}|${proc}`
 * @param {{ limite?: number, scoreMinimo?: number, imovelIdFiltro?: number, estrategia?: 'melhorPorLancamento'|'todosParesQualificados', maxParesPorLancamento?: number }} opts
 */
export function gerarSugestoesVinculoImoveis(candidatos, imoveis, historicosPorChave, opts = {}) {
  const limite = opts.limite ?? 40;
  const scoreMinimo = opts.scoreMinimo ?? 38;
  const estrategia = opts.estrategia ?? 'melhorPorLancamento';
  const maxParesPorLancamento = opts.maxParesPorLancamento ?? 6;

  const ocupados = (imoveis || []).filter((i) => i.imovelOcupado && String(i.codigo ?? '').trim() && String(i.proc ?? '').trim());
  const filtrados =
    opts.imovelIdFiltro != null
      ? ocupados.filter((i) => Number(i.imovelId) === Number(opts.imovelIdFiltro))
      : ocupados;

  const porInquilino = new Map();
  const porProprietario = new Map();
  for (const im of filtrados) {
    const ki = normalizarTexto(im.inquilino);
    if (ki) {
      if (!porInquilino.has(ki)) porInquilino.set(ki, []);
      porInquilino.get(ki).push(im);
    }
    const kp = normalizarTexto(im.proprietario);
    if (kp) {
      if (!porProprietario.has(kp)) porProprietario.set(kp, []);
      porProprietario.get(kp).push(im);
    }
  }

  const sugestoes = [];

  function pushSugestao(lanc, im, pont, ehDebito) {
    const dataBr = dataApiParaBr(lanc.dataLancamento);
    const cod = String(im.codigo ?? '').replace(/\D/g, '');
    const proc = String(im.proc ?? '').replace(/\D/g, '');
    sugestoes.push({
      sugestaoKey: `${lanc.id}|${cod}|${proc}`,
      lancamentoId: lanc.id,
      natureza: ehDebito ? 'DEBITO' : 'CREDITO',
      data: dataBr,
      valor: valorAbsolutoLancamentoApi(lanc),
      descricao: String(lanc.descricao ?? ''),
      descricaoDetalhada: String(lanc.descricaoDetalhada ?? ''),
      bancoNome: String(lanc.bancoNome ?? ''),
      numeroBanco: lanc.numeroBanco ?? null,
      codigoCliente: cod,
      proc,
      processoIdApi: im._apiProcessoId ?? null,
      clienteIdApi: im._apiClienteId ?? null,
      imovelId: im.imovelId,
      unidade: im.unidade || im.condominio || '—',
      locatario: ehDebito ? im.proprietario || '—' : im.inquilino || '—',
      rotuloPessoa: ehDebito ? 'Locador' : 'Locatário',
      valorReferencia: parseValorMonetarioBr(im.valorLocacao) ?? 0,
      diaPagamento: ehDebito ? im.diaRepasse : im.diaPagAluguel,
      confianca: pont.confianca,
      score: pont.score,
      motivos: pont.motivos,
      tipo: pont.tipo,
      mesReferencia: pont.mesReferencia,
      chaveMes: pont.chaveMes,
      tagSugerida:
        pont.tipo === TIPO_SUGESTAO_ALUGUEL
          ? TAG_ADM_ALUGUEL
          : pont.tipo === TIPO_SUGESTAO_REPASSE
            ? TAG_ADM_REPASSE
            : '',
    });
  }

  function pontosProximidadeValorDebito(par, valorLanc) {
    const chaveHist = `${String(par.im.codigo).replace(/\D/g, '')}|${String(par.im.proc).replace(/\D/g, '')}`;
    const historico = historicosPorChave.get(chaveHist) ?? construirPerfilHistoricoImovel([]);
    const match = melhorMatchValorHistorico(valorLanc, historico.valoresDebito ?? []);
    if (match) return (match.exato ? 1000 : 500) - match.diff;
    if (historico.valorMedianoDebito != null) {
      const { proximo, diff } = valorCombinaReferencia(valorLanc, historico.valorMedianoDebito);
      if (proximo) return 200 - diff;
    }
    return 0;
  }

  for (const lanc of candidatos || []) {
    if (!lancamentoApiExtratoBanco(lanc) || !lancamentoApiSemVinculoProcesso(lanc)) continue;

    const ehDebito = lancamentoApiDebitoBanco(lanc);
    const texto = textoLancamentoParaMatch(lanc);
    const haPessoaNoTexto = pagadorAparenteNoLancamento(texto);
    const valorLanc = valorAbsolutoLancamentoApi(lanc);

    const pares = [];
    for (const im of filtrados) {
      const chaveHist = `${String(im.codigo).replace(/\D/g, '')}|${String(im.proc).replace(/\D/g, '')}`;
      const historico = historicosPorChave.get(chaveHist) ?? construirPerfilHistoricoImovel([]);
      const pessoaKey = normalizarTexto(ehDebito ? im.proprietario : im.inquilino);
      const pessoaUnica = ehDebito
        ? pessoaKey
          ? (porProprietario.get(pessoaKey)?.length ?? 0) === 1
          : false
        : pessoaKey
          ? (porInquilino.get(pessoaKey)?.length ?? 0) === 1
          : false;
      const pessoaCadastro = ehDebito ? im.proprietario : im.inquilino;
      const nome = analisarMatchNomeLocatario({ inquilino: pessoaCadastro }, texto);
      const pont = pontuarSugestaoVinculoImovel(lanc, im, historico, {
        inquilinoUnico: !ehDebito && pessoaUnica,
        proprietarioUnico: ehDebito && pessoaUnica,
        nome,
        ehDebito,
      });
      if (pont.score < scoreMinimo) continue;
      pares.push({ im, pont, nome, historico });
    }

    if (pares.length === 0) continue;

    let paresFinais = pares;
    if (haPessoaNoTexto) {
      const comNome = pares.filter((p) => p.nome.elegivelModoGeral);
      if (comNome.length > 0) paresFinais = comNome;
    }

    if (ehDebito && paresFinais.length > 1) {
      const comValorHist = paresFinais.filter((p) => pontosProximidadeValorDebito(p, valorLanc) > 0);
      if (comValorHist.length === 1) {
        paresFinais = comValorHist;
      } else if (comValorHist.length > 1) {
        paresFinais = comValorHist;
      }
    }

    const ordenar = (a, b) => {
      if (ehDebito) {
        const dv = pontosProximidadeValorDebito(b, valorLanc) - pontosProximidadeValorDebito(a, valorLanc);
        if (dv !== 0) return dv;
      }
      const dn = (b.nome?.pontosNome ?? 0) - (a.nome?.pontosNome ?? 0);
      if (dn !== 0) return dn;
      return b.pont.score - a.pont.score;
    };

    if (estrategia === 'todosParesQualificados') {
      paresFinais.sort(ordenar);
      for (const { im, pont } of paresFinais.slice(0, maxParesPorLancamento)) {
        pushSugestao(lanc, im, pont, ehDebito);
      }
      continue;
    }

    const melhor = paresFinais.reduce((best, cur) => {
      if (!best) return cur;
      return ordenar(cur, best) < 0 ? cur : best;
    }, null);
    if (melhor) pushSugestao(lanc, melhor.im, melhor.pont, ehDebito);
  }

  sugestoes.sort((a, b) => b.score - a.score);
  return sugestoes.slice(0, limite);
}

/** Converte lançamento UI (mapApiLancamentoToUi) para forma usada no perfil histórico. */
export function lancamentoUiParaPerfilHistorico(t, proc) {
  const br = String(t.data ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  const v = Number(t.valor) || 0;
  return {
    dataLancamento: iso,
    valor: Math.abs(v),
    natureza: v >= 0 ? 'CREDITO' : 'DEBITO',
    bancoNome: t.nomeBanco,
    descricao: t.descricao,
    descricaoDetalhada: t.descricaoDetalhada,
    processoId: t._financeiroMeta?.processoId ?? 1,
    numeroInternoProcesso: proc,
  };
}

export function mesesRecentesParaBusca(quantidade = 4, ref = new Date()) {
  const out = [];
  let y = ref.getFullYear();
  let m = ref.getMonth() + 1;
  for (let i = 0; i < quantidade; i++) {
    out.push({ ano: y, mes: m });
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}
