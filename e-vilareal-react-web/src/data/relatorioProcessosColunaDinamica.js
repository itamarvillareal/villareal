/**
 * Coluna dinâmica do Relatório Processos (mesma coluna física; título e conteúdo escolhidos pelo usuário).
 */
import { getCamposExtrasRelatorioPorProcesso, padCliente } from './processosDadosRelatorio.js';

export const STORAGE_CAMPO_COLUNA_ULTIMO_ANDAMENTO = 'vilareal.relatorioProcessos.campoColunaUltimoAndamento.v1';

/**
 * Opções de título/conteúdo: dados do relatório + todos os campos alinhados à tela Processos (cadastro, imóvel, histórico).
 * @type {Array<{ label: string, fieldKey: string }>}
 */
export const CAMPOS_OPCOES_ULTIMO_ANDAMENTO = [
  // — Relatório (dataset da grade) —
  { label: 'Último Andamento', fieldKey: 'ultimoAndamento' },
  { label: 'Observação de Fase', fieldKey: 'observacaoFase' },
  { label: 'Próxima Consulta', fieldKey: 'proximaConsulta' },
  { label: 'Prazo Fatal', fieldKey: 'prazoFatal' },
  { label: 'Observação do Processo', fieldKey: 'observacaoProcesso' },
  { label: 'Descrição da Ação', fieldKey: 'descricaoAcao' },
  { label: 'Fase (relatório)', fieldKey: 'fase' },
  { label: 'Competência (relatório)', fieldKey: 'competencia' },
  { label: 'Data da Consulta', fieldKey: 'dataConsulta' },
  { label: 'Data da Audiência', fieldKey: 'dataAudiencia' },
  { label: 'Hora da Audiência', fieldKey: 'horaAudiencia' },
  { label: 'Consultor', fieldKey: 'consultor' },
  { label: 'In Requerente/Recurso', fieldKey: 'inRequerente' },
  { label: 'CEP [primeiro réu]', fieldKey: 'cepReu' },
  { label: 'Lmv', fieldKey: 'lmv' },
  { label: 'Inv', fieldKey: 'inv' },
  { label: 'Consultas', fieldKey: 'consultas' },
  // — Cadastro Processos (mock + persistência) —
  { label: 'Cód. Cliente (processo)', fieldKey: 'codigoClienteProcesso' },
  { label: 'Nº interno do processo', fieldKey: 'numeroProcessoInterno' },
  { label: 'Cliente (cadastro processo)', fieldKey: 'clienteCadastroProcesso' },
  { label: 'Parte Cliente', fieldKey: 'parteCliente' },
  { label: 'Parte Oposta', fieldKey: 'parteOposta' },
  { label: 'Estado', fieldKey: 'estadoProcesso' },
  { label: 'Cidade', fieldKey: 'cidadeProcesso' },
  { label: 'Fase (cadastro processo)', fieldKey: 'faseCadastroProcesso' },
  { label: 'Competência (cadastro processo)', fieldKey: 'competenciaCadastroProcesso' },
  { label: 'Nº Processo (antigo)', fieldKey: 'numeroProcessoVelho' },
  { label: 'Nº Processo (novo / CNJ)', fieldKey: 'numeroProcessoNovo' },
  { label: 'Status (ativo/inativo)', fieldKey: 'statusAtivoTexto' },
  { label: 'Parte Requerente', fieldKey: 'parteRequerenteTexto' },
  { label: 'Parte Réu (polo)', fieldKey: 'parteRevelTexto' },
  { label: 'Parte Requerido', fieldKey: 'parteRequeridoTexto' },
  { label: 'Data protocolo', fieldKey: 'dataProtocolo' },
  { label: 'Natureza da ação', fieldKey: 'naturezaAcaoProcesso' },
  { label: 'Valor da causa', fieldKey: 'valorCausaProcesso' },
  { label: 'Consulta automática', fieldKey: 'consultaAutomaticaTexto' },
  { label: 'Observação (cadastro processo)', fieldKey: 'observacaoCadastroProcesso' },
  { label: 'Tramitação', fieldKey: 'tramitacao' },
  { label: 'Periodicidade da consulta', fieldKey: 'periodicidadeConsulta' },
  { label: 'Prazo fatal (cadastro)', fieldKey: 'prazoFatalCadastroProcesso' },
  { label: 'Próxima consulta (calculada)', fieldKey: 'proximaConsultaCalculada' },
  { label: 'Último movimento (histórico)', fieldKey: 'ultimoHistoricoInfo' },
  { label: 'Data último movimento', fieldKey: 'ultimoHistoricoData' },
  { label: 'Tipo de audiência (processo)', fieldKey: 'tipoAudienciaProcesso' },
  { label: 'Data audiência (processo)', fieldKey: 'audienciaDataProcesso' },
  { label: 'Hora audiência (processo)', fieldKey: 'audienciaHoraProcesso' },
  { label: 'Pasta / arquivo (mock)', fieldKey: 'pastaArquivoProcesso' },
  { label: 'Procedimento (mock)', fieldKey: 'procedimentoProcesso' },
  { label: 'Responsável (mock)', fieldKey: 'responsavelProcesso' },
  // — Imóvel vinculado —
  { label: 'Cód. imóvel vinculado', fieldKey: 'imovelIdVinculado' },
  { label: 'Unidade (imóvel)', fieldKey: 'unidadeImovel' },
  { label: 'Endereço (imóvel)', fieldKey: 'enderecoImovel' },
  { label: 'Condomínio (imóvel)', fieldKey: 'condominioImovel' },
  { label: 'Unidade (resumo)', fieldKey: 'unidade' },
  // — Pessoas (exibição cadastro) —
  { label: 'Título Pessoa 1 Réu', fieldKey: 'tituloPessoa1Reu' },
  { label: 'N Pessoa 1 Réu', fieldKey: 'nPessoa1Reu' },
  { label: 'N End Pessoa 1 Réu', fieldKey: 'nEndPessoa1Reu' },
  { label: 'Título Pessoa 1 Autor', fieldKey: 'tituloPessoa1Autor' },
  { label: 'N Pessoa 1 Autor', fieldKey: 'nPessoa1Autor' },
  { label: 'N End Pessoa 1 Autor', fieldKey: 'nEndPessoa1Autor' },
  { label: 'Tipo de Audiência (legado)', fieldKey: 'tipoAudiencia' },
];

export const CAMPO_PADRAO_ULTIMO_ANDAMENTO = 'ultimoAndamento';

/** Campos desta coluna dinâmica que são datas dd/mm/aaaa (para ordenação cronológica). */
export const CAMPOS_DATA_COLUNA_DINAMICA = new Set([
  'proximaConsulta',
  'prazoFatal',
  'dataConsulta',
  'dataAudiencia',
  'dataProtocolo',
  'prazoFatalCadastroProcesso',
  'proximaConsultaCalculada',
  'ultimoHistoricoData',
  'audienciaDataProcesso',
]);

const CAMPOS_KEYS = new Set(CAMPOS_OPCOES_ULTIMO_ANDAMENTO.map((o) => o.fieldKey));

/** Migração: chaves antigas renomeadas → equivalente atual. */
const MIGRACAO_CAMPOS = {
  // nenhuma por enquanto
};

export function carregarCampoUltimoAndamentoSalvo() {
  if (typeof window === 'undefined') return CAMPO_PADRAO_ULTIMO_ANDAMENTO;
  try {
    const raw = window.localStorage.getItem(STORAGE_CAMPO_COLUNA_ULTIMO_ANDAMENTO);
    if (!raw) return CAMPO_PADRAO_ULTIMO_ANDAMENTO;
    const migrated = MIGRACAO_CAMPOS[raw] ?? raw;
    const ok = CAMPOS_KEYS.has(migrated);
    return ok ? migrated : CAMPO_PADRAO_ULTIMO_ANDAMENTO;
  } catch {
    return CAMPO_PADRAO_ULTIMO_ANDAMENTO;
  }
}

export function salvarCampoUltimoAndamento(fieldKey) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_CAMPO_COLUNA_ULTIMO_ANDAMENTO, fieldKey);
  } catch {
    /* ignore */
  }
}

/** Garante uma chave válida para a coluna dinâmica (presets / importação). */
export function normalizarCampoColunaDinamica(fieldKey) {
  const migrated = MIGRACAO_CAMPOS[fieldKey] ?? fieldKey;
  return CAMPOS_KEYS.has(migrated) ? migrated : CAMPO_PADRAO_ULTIMO_ANDAMENTO;
}

/**
 * Enriquece cada linha com dados do cadastro Processos (por codCliente + proc),
 * para a coluna dinâmica refletir o mesmo processo da linha.
 */
export function enriquecerCamposRelatorioProcessos(row, idx) {
  const cod = row.codCliente != null && String(row.codCliente).trim() !== '' ? row.codCliente : String(idx + 1).padStart(8, '0');
  const proc = row.proc != null && String(row.proc).trim() !== '' ? row.proc : '1';
  const extras = getCamposExtrasRelatorioPorProcesso(padCliente(cod), proc);
  return {
    ...row,
    ...extras,
  };
}
