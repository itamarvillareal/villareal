/**
 * Padrões de nome de arquivo para descoberta e seleção de contratos.
 * Atualize aqui após cada varredura de inventário.
 */

/** Prioridade 1 = leitura obrigatória na fase de extração. */
export const PADROES_CANDIDATO_CONTRATO = [
  {
    id: 'contrato_prefixo',
    descricao: 'Arquivo começa com Contrato',
    regex: /^contrato/i,
    prioridade: 1,
    peso: 100,
  },
  {
    id: 'honorarios_advocaticios',
    descricao: 'Contrato de honorários advocatícios no nome',
    regex: /honor[aá]rios?\s+advocat/i,
    prioridade: 1,
    peso: 120,
  },
  {
    id: 'contrato_de_honorarios',
    descricao: 'Contrato de honorários (escritório)',
    regex: /contrato\s+de\s+honor/i,
    prioridade: 1,
    peso: 115,
  },
  {
    id: 'contrato_de',
    descricao: 'Contrato de … no nome',
    regex: /contrato\s+de\s+/i,
    prioridade: 1,
    peso: 90,
  },
  {
    id: 'contrato_numero',
    descricao: 'CONTRATO seguido de número (ex.: CONTRATO 41120)',
    regex: /^contrato\s+\d/i,
    prioridade: 1,
    peso: 85,
  },
  {
    id: 'contratoassinado',
    descricao: 'contratoassinado.pdf (colado)',
    regex: /^contratoassinado/i,
    prioridade: 1,
    peso: 80,
  },
  {
    id: 'contrato_permanencia',
    descricao: 'Contrato de permanência',
    regex: /contrato\s+de\s+perman/i,
    prioridade: 2,
    peso: 70,
  },
];

/** Documentos processuais com “honorários” — inventariar e ler, mas não importar como contrato. */
export const PADROES_HONOR_PROCESSUAL = [
  {
    id: 'certidao_honorarios',
    regex: /certid[aã]o\s+de\s+honor/i,
    prioridade: 4,
  },
  {
    id: 'manifestacao_honorarios',
    regex: /manifesta[cç][aã]o\s+honor/i,
    prioridade: 4,
  },
  {
    id: 'honorarios_generico',
    regex: /honor[aá]rios|honorarios/i,
    prioridade: 4,
  },
];

/** Excluídos da fase de leitura/extração de contrato (ainda entram no inventário). */
export const PADROES_EXCLUIR_LEITURA = [
  { id: 'acordo', regex: /acordo/i },
  { id: 'contrato_se77e', regex: null },
  { id: 'peticao_inicial', regex: /^peti[cç][aã]o\s+inicial/i },
  { id: 'interlocutoria', regex: /^interlocut[oó]ria/i },
  { id: 'lista_debitos', regex: /^lista\s+de\s+d[eé]bitos/i },
  { id: 'foto', regex: /^foto\s*-/i },
  { id: 'rede_busca', regex: /^rede\s+busca/i },
  { id: 'comprovante', regex: /^comprovante/i },
  { id: 'manifestacao', regex: /^manifesta[cç][aã]o/i },
  { id: 'desistencia', regex: /^desist[eê]ncia/i },
  { id: 'impugnacao', regex: /^impugna[cç][aã]o/i },
  { id: 'execucao_sentenca', regex: /^execu[cç][aã]o\s+de\s+senten/i },
  { id: 'requer', regex: /^requer\b/i },
  { id: 'whatsapp', regex: /^wa?hts?app/i },
  { id: 'movimentacao_sem_honor', regex: /^movimenta[cç][aã]o/i },
  { id: 'juntada', regex: /^juntada/i },
  { id: 'certidao_generica', regex: /^certid[aã]o/i },
  { id: 'decisao', regex: /^decis[aã]o/i },
  { id: 'sentenca', regex: /^senten[cç]a/i },
  { id: 'procuracao', regex: /^procura[cç][aã]o/i },
  { id: 'substabelecimento', regex: /^substabelecimento/i },
  { id: 'cobranca', regex: /^cobran[cç]a/i },
];

export const EXTENSOES_INVENTARIO = ['.pdf', '.docx', '.doc'];

/** Clientes/pastas cujo contrato de assinante telecom não entra na leitura. */
export const CLIENTES_CONTRATO_TELECOM_EXCLUIDO = ['SE77E TELECOM', '00000728'];

export function isContratoTelecomSe77eExcluido(caminhoOuPastaCliente) {
  const s = normalizarParaMatch(String(caminhoOuPastaCliente ?? ''));
  return CLIENTES_CONTRATO_TELECOM_EXCLUIDO.some((m) => s.includes(normalizarParaMatch(m)));
}

function normalizarParaMatch(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/**
 * @param {string} nomeArquivo
 * @param {{ caminhoAbsoluto?: string, pastaCliente?: string }} [ctx]
 */
export function classificarNomeArquivo(nomeArquivo, ctx = {}) {
  const base = pathBasename(nomeArquivo);
  const norm = normalizarParaMatch(base);
  const caminhoCtx = ctx.caminhoAbsoluto || ctx.pastaCliente || '';
  let candidato = null;
  let honorProcessual = null;
  let excluir = null;

  for (const p of PADROES_CANDIDATO_CONTRATO) {
    if (p.regex.test(base) || p.regex.test(norm)) {
      if (!candidato || p.peso > candidato.peso) candidato = { ...p, match: base.match(p.regex)?.[0] ?? '' };
    }
  }
  for (const p of PADROES_HONOR_PROCESSUAL) {
    if (p.regex.test(base) || p.regex.test(norm)) {
      honorProcessual = { ...p, match: 'honorarios' };
    }
  }
  for (const p of PADROES_EXCLUIR_LEITURA) {
    if (!p.regex) continue;
    if (p.regex.test(base) || p.regex.test(norm)) {
      excluir = { ...p, match: base.match(p.regex)?.[0] ?? '' };
      break;
    }
  }

  const honorAdvNome = /honor[aá]rios?\s+advocat/i.test(base) || /honor[aá]rios?\s+advocat/i.test(norm);
  const honorEscritorioNome =
    honorAdvNome || /contrato\s+de\s+honor/i.test(base) || /contrato\s+de\s+honor/i.test(norm);
  if (
    candidato &&
    !honorEscritorioNome &&
    isContratoTelecomSe77eExcluido(caminhoCtx)
  ) {
    excluir = { id: 'contrato_se77e', match: 'SE77E TELECOM' };
    candidato = null;
  }

  if (honorProcessual && excluir?.id === 'movimentacao_sem_honor') {
    excluir = null;
  }
  if (candidato && excluir && !['acordo', 'contrato_se77e'].includes(excluir.id) && candidato.prioridade <= 2) {
    excluir = null;
  }
  if (candidato && excluir && ['acordo', 'contrato_se77e'].includes(excluir.id)) {
    candidato = null;
  }

  let prioridadeLeitura = null;
  let motivo = 'NAO_SELECIONADO';
  if (candidato) {
    prioridadeLeitura = candidato.prioridade;
    motivo = `CANDIDATO_CONTRATO:${candidato.id}`;
  } else if (honorProcessual) {
    motivo = `HONOR_PROCESSUAL:${honorProcessual.id}`;
  } else if (!excluir) {
    prioridadeLeitura = 5;
    motivo = 'INVENTARIO_SEM_PADRAO';
  } else {
    motivo = `EXCLUIDO:${excluir.id}`;
  }

  return { candidato, honorProcessual, excluir, prioridadeLeitura, motivo };
}

export function normalizarNomeParaPadrao(nomeArquivo) {
  let s = pathBasename(nomeArquivo);
  s = s.normalize('NFD').replace(/\p{M}/gu, '');
  s = s.replace(/\d{2}\/\d{2}\/\d{2,4}/g, '{DATA}');
  s = s.replace(/\d{1,2}-\d{2}-\d{4}/g, '{DATA}');
  s = s.replace(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g, '{CNJ}');
  s = s.replace(/\b\d{3,}\b/g, '{NUM}');
  s = s.replace(/\s+-\s+[A-Z][A-Za-zÀ-ú\s]{4,}/g, ' - {NOME}');
  s = s.replace(/\b[A-Z][A-ZÀ-Ú\s]{10,}\b/g, '{NOME}');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function pathBasename(p) {
  const parts = String(p).split(/[/\\]/);
  return parts[parts.length - 1] ?? p;
}
